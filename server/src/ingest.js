import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { Throttle } from './auth.js';
import { transaction } from './db.js';

const digest = (value) => createHash('sha256').update(value).digest();
/** Hash to a fixed length before comparing, including malformed and missing credentials. */
export function isIngestAuthorization(header, token) {
  if (!token) return false;
  const supplied = /^Bearer (\S+)$/.exec(header ?? '')?.[1] ?? '';
  return timingSafeEqual(digest(supplied), digest(token));
}

export class IngestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
  });
const currency = z.enum(['CNY', 'USD', 'HKD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD']);
const amount = z.number().finite().min(0).max(1e15);
const optional = (schema) => schema.nullish();
const statementSchema = z
  .object({
    sourceMessageId: z.string().min(1).max(200),
    productId: optional(z.string().min(1).max(100)),
    issuer: z.string().trim().min(1).max(100),
    cardLast4: optional(z.string().regex(/^[0-9]{4}$/)),
    billEmail: optional(z.string().trim().toLowerCase().email().max(254)),
    statementDate: optional(date),
    dueDate: date,
    statementBalance: amount,
    minimumPayment: optional(amount),
    currency,
    receivedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine((row) => row.minimumPayment == null || row.minimumPayment <= row.statementBalance);
const batchSchema = z.object({ statements: z.array(z.unknown()).max(1000) }).strict();
const normalized = (value) => (value ?? '').trim().toLowerCase();

/** Explicit IDs stay scoped to the first user; ambiguous matches never choose a card by chance. */
export function matchProduct(statement, cards) {
  if (statement.productId) return cards.find((card) => card.id === statement.productId) ?? null;
  if (!statement.billEmail) return null;
  const email = cards.filter((card) => normalized(card.bill_email) === statement.billEmail);
  if (statement.cardLast4) {
    const exact = email.filter((card) => card.card_last4 === statement.cardLast4);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
  }
  const issuer = email.filter((card) => normalized(card.issuer) === normalized(statement.issuer));
  return issuer.length === 1 ? issuer[0] : null;
}

export function createIngestRoutes({ pool, token, readJson, log = console }) {
  const throttle = new Throttle({ limit: 60, windowMs: 60 * 60 * 1000 });
  function authorize(req) {
    if (!token) throw new IngestError(404, 'not_found');
    if (throttle.blocked('ingest')) throw new IngestError(429, 'too_many_requests');
    if (!isIngestAuthorization(req.headers.authorization, token)) {
      throttle.fail('ingest');
      throw new IngestError(401, 'unauthorized');
    }
  }
  async function owner(client) {
    const { rows } = await client.query('SELECT id FROM users ORDER BY created_at, id LIMIT 1');
    if (!rows[0]) throw new IngestError(409, 'no_user');
    return rows[0].id;
  }
  const cardsFor = async (client, userId) =>
    (
      await client.query(
        `SELECT id, name, issuer, kind, currency, card_last4, bill_email, statement_day, due_day
     FROM credit_products WHERE user_id = $1 AND is_active ORDER BY created_at, id`,
        [userId]
      )
    ).rows;

  return {
    'GET /api/ingest/cards': async (req) => {
      authorize(req);
      const cards = await cardsFor(pool, await owner(pool));
      return cards.map((card) => ({
        id: card.id,
        name: card.name,
        issuer: card.issuer,
        type: card.kind,
        currency: card.currency,
        cardLast4: card.card_last4,
        billEmail: card.bill_email,
        statementDay: card.statement_day,
        dueDay: card.due_day,
      }));
    },
    'POST /api/ingest/statements': async (req) => {
      authorize(req);
      const parsed = batchSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new IngestError(400, 'invalid_batch');
      const results = await transaction(pool, async (client) => {
        const userId = await owner(client);
        // Same lock as snapshot replacement: a bill and a device upload cannot interleave.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
        const cards = await cardsFor(client, userId);
        const results = [];
        let changed = false;
        for (const raw of parsed.data.statements) {
          const sourceMessageId =
            typeof raw?.sourceMessageId === 'string' ? raw.sourceMessageId.slice(0, 200) : '';
          const input = statementSchema.safeParse(raw);
          if (!input.success) {
            results.push({ sourceMessageId, status: 'invalid', reason: 'invalid_statement' });
            continue;
          }
          const row = input.data;
          const existing = await client.query(
            'SELECT product_id FROM bill_statements WHERE user_id = $1 AND source_message_id = $2',
            [userId, sourceMessageId]
          );
          if (existing.rows.length) {
            results.push({
              sourceMessageId,
              status: 'duplicate',
              productId: existing.rows[0].product_id,
            });
            continue;
          }
          const card = matchProduct(row, cards);
          if (!card) {
            results.push({
              sourceMessageId,
              status: 'unmatched',
              reason: 'no_unique_active_product',
            });
            continue;
          }
          if (card.currency.trim() !== row.currency) {
            results.push({ sourceMessageId, status: 'invalid', reason: 'currency_mismatch' });
            continue;
          }
          const inserted = await client.query(
            `INSERT INTO bill_statements (user_id, product_id, source_message_id, issuer, card_last4, statement_date,
              due_date, statement_balance, minimum_payment, currency, received_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (user_id, source_message_id) DO NOTHING RETURNING id`,
            [
              userId,
              card.id,
              sourceMessageId,
              row.issuer,
              row.cardLast4 ?? null,
              row.statementDate ?? null,
              row.dueDate,
              row.statementBalance,
              row.minimumPayment ?? null,
              row.currency,
              row.receivedAt,
            ]
          );
          if (!inserted.rows.length) {
            results.push({ sourceMessageId, status: 'duplicate', productId: card.id });
            continue;
          }
          changed = true;
          // Billing-cycle order takes precedence over arrival order: delayed mail cannot roll a bill back.
          const latest = await client.query(
            `SELECT id FROM bill_statements WHERE user_id = $1 AND product_id = $2
             ORDER BY due_date DESC, statement_date DESC NULLS LAST, received_at DESC, source_message_id DESC LIMIT 1`,
            [userId, card.id]
          );
          if (latest.rows[0].id === inserted.rows[0].id) {
            await client.query(
              'UPDATE credit_products SET statement_balance = $1, minimum_payment = $2 WHERE id = $3 AND user_id = $4',
              [row.statementBalance, row.minimumPayment ?? null, card.id, userId]
            );
          }
          results.push({ sourceMessageId, status: 'created', productId: card.id });
        }
        if (changed)
          await client.query(
            `INSERT INTO sync_state (user_id, app_schema, exported_at, revision) VALUES ($1, 3, now(), 1)
           ON CONFLICT (user_id) DO UPDATE SET revision = sync_state.revision + 1, updated_at = now()`,
            [userId]
          );
        return results;
      });
      const counts = { created: 0, duplicate: 0, unmatched: 0, invalid: 0 };
      for (const result of results) counts[result.status]++;
      log.info?.('bill_ingest', counts);
      return { results };
    },
  };
}
