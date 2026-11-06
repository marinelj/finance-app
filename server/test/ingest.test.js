// Use a separate, disposable database: the existing API suite resets its own public schema.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';

import { createApp } from '../src/app.js';
import { migrate, transaction } from '../src/db.js';
import { isIngestAuthorization, matchProduct } from '../src/ingest.js';
import { currentRevision, loadColumns, readSnapshot, replaceSnapshot } from '../src/sync.js';

const token = 'synthetic-ingest-credential-for-tests-only-32-bytes';
const config = {
  ingestToken: token,
  signup: 'first',
  corsOrigins: [],
  sessionDays: 90,
  maxBodyMb: 1,
};
const url = process.env.INGEST_TEST_DATABASE_URL;
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';

it('compares ingest authorization at a fixed digest length', () => {
  assert.equal(isIngestAuthorization(`Bearer ${token}`, token), true);
  assert.equal(isIngestAuthorization('Bearer bad', token), false);
  assert.equal(isIngestAuthorization(undefined, token), false);
  assert.equal(isIngestAuthorization(`Bearer ${token}`, undefined), false);
});
it('never chooses an ambiguous match', () => {
  const cards = [
    { id: 'a', bill_email: 'same@example.test', issuer: 'Bank', card_last4: '1234' },
    { id: 'b', bill_email: 'same@example.test', issuer: 'Bank', card_last4: '5678' },
  ];
  assert.equal(matchProduct({ billEmail: 'same@example.test', issuer: 'Bank' }, cards), null);
  assert.equal(
    matchProduct({ billEmail: 'same@example.test', issuer: 'Bank', cardLast4: '1234' }, cards).id,
    'a'
  );
});

async function start(pool, overrides = {}, log = { error() {}, info() {} }) {
  const server = createServer(createApp({ pool, config: { ...config, ...overrides }, log }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, auth = token) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  return { server, call };
}

// These handler tests need no database and run even without integration-test credentials.
it('returns 404 when disabled, 401 for wrong auth, and 429 after 60 failed attempts', async () => {
  const disabled = await start(null, { ingestToken: undefined });
  const enabled = await start(null);
  try {
    for (const [method, path] of [
      ['GET', '/api/ingest/cards'],
      ['POST', '/api/ingest/statements'],
    ]) {
      assert.equal(
        (await disabled.call(method, path, method === 'POST' ? { statements: [] } : undefined))
          .status,
        404
      );
    }
    for (let i = 0; i < 60; i++)
      assert.equal((await enabled.call('GET', '/api/ingest/cards', undefined, 'bad')).status, 401);
    assert.equal((await enabled.call('GET', '/api/ingest/cards')).status, 429);
  } finally {
    disabled.server.close();
    enabled.server.close();
  }
});

it('successful ingest requests never consume the authentication failure limit', async () => {
  const pool = {
    query: async (sql) => ({ rows: sql.includes('FROM users') ? [{ id: owner }] : [] }),
  };
  const api = await start(pool);
  try {
    for (let i = 0; i < 120; i++)
      assert.equal((await api.call('GET', '/api/ingest/cards')).status, 200);
  } finally {
    api.server.close();
  }
});

describe(
  'bill ingestion integration',
  { skip: !url && 'INGEST_TEST_DATABASE_URL is not set' },
  () => {
    let pool, api;
    const events = [];
    before(async () => {
      if (!/test/i.test(new URL(url).pathname)) throw new Error('Use a disposable test database');
      pool = new pg.Pool({ connectionString: url });
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      await migrate(pool);
      await pool.query(
        `INSERT INTO users (id,email,password_hash,created_at) VALUES ($1,'owner@example.test','unused','2020-01-01'),($2,'other@example.test','unused','2021-01-01')`,
        [owner, other]
      );
      for (const [id, email, last4, issuer, active, user] of [
        ['a', 'one@example.test', '1234', 'Synthetic Bank', true, owner],
        ['b', 'shared@example.test', '2222', 'Same Bank', true, owner],
        ['c', 'shared@example.test', '3333', 'Same Bank', true, owner],
        ['d', 'unique@example.test', null, 'Unique Bank', true, owner],
        ['closed', 'closed@example.test', null, 'Bank', false, owner],
        ['foreign', 'foreign@example.test', null, 'Bank', true, other],
      ])
        await pool.query(
          `INSERT INTO credit_products (id,user_id,name,issuer,kind,currency,color,emoji,bill_email,card_last4,is_active,balance,statement_day,due_day,due_rule) VALUES ($1,$2,'Synthetic card',$3,'credit_card','CNY','#000','X',$4,$5,$6,1000,5,23,'fixed_day')`,
          [id, user, issuer, email, last4, active]
        );
      api = await start(
        pool,
        {},
        { error: (event) => events.push(event), info: (...args) => events.push(args) }
      );
    });
    after(async () => {
      api?.server.close();
      await pool?.end();
    });
    const bill = (sourceMessageId, extra = {}) => ({
      sourceMessageId,
      issuer: 'Synthetic Bank',
      productId: 'a',
      dueDate: '2026-11-23',
      statementDate: '2026-11-05',
      statementBalance: 120,
      minimumPayment: 12,
      currency: 'CNY',
      receivedAt: '2026-11-06T08:00:00Z',
      ...extra,
    });
    const post = (statements) => api.call('POST', '/api/ingest/statements', { statements });

    it('scopes the ingest token and cards metadata allowlist', async () => {
      for (const path of ['/api/me', '/api/sync', '/api/sync/revision'])
        assert.equal((await api.call('GET', path)).status, 401);
      assert.equal((await api.call('PUT', '/api/sync', {})).status, 401);
      const cards = await api.call('GET', '/api/ingest/cards');
      assert.equal(cards.status, 200);
      assert.deepEqual(cards.body.map((card) => card.id).sort(), ['a', 'b', 'c', 'd']);
      assert.deepEqual(
        Object.keys(cards.body[0]).sort(),
        [
          'id',
          'name',
          'issuer',
          'type',
          'currency',
          'cardLast4',
          'billEmail',
          'statementDay',
          'dueDay',
        ].sort()
      );
      assert.equal((await api.call('GET', '/api/ingest/cards', undefined, null)).status, 401);
    });
    it('matches explicit IDs, email plus last four, and unique email plus issuer; bumps once', async () => {
      const before = await currentRevision(pool, owner);
      const result = await post([
        bill('explicit'),
        bill('by-last4', {
          productId: undefined,
          billEmail: 'SHARED@EXAMPLE.TEST',
          cardLast4: '2222',
          issuer: 'Same Bank',
        }),
        bill('by-issuer', {
          productId: undefined,
          billEmail: 'unique@example.test',
          issuer: 'Unique Bank',
        }),
      ]);
      assert.equal(result.status, 200);
      assert.deepEqual(
        result.body.results.map((r) => [r.status, r.productId]),
        [
          ['created', 'a'],
          ['created', 'b'],
          ['created', 'd'],
        ]
      );
      assert.equal(await currentRevision(pool, owner), before + 1);
      const {
        rows: [product],
      } = await pool.query(
        'SELECT balance,statement_balance,minimum_payment,statement_day,due_day FROM credit_products WHERE id = $1',
        ['a']
      );
      assert.deepEqual(product, {
        balance: 1000,
        statement_balance: 120,
        minimum_payment: 12,
        statement_day: 5,
        due_day: 23,
      });
    });
    it('replays are no-ops, even when the repeated figures differ', async () => {
      const before = await currentRevision(pool, owner);
      assert.equal(
        (await post([bill('explicit', { statementBalance: 999 })])).body.results[0].status,
        'duplicate'
      );
      assert.equal(await currentRevision(pool, owner), before);
      assert.equal(
        (await pool.query("SELECT statement_balance FROM credit_products WHERE id='a'")).rows[0]
          .statement_balance,
        120
      );
    });
    it('rejects ambiguous, inactive, foreign, malformed and full-number inputs without writes', async () => {
      const before = await currentRevision(pool, owner);
      const response = await post([
        bill('ambiguous', {
          productId: undefined,
          billEmail: 'shared@example.test',
          issuer: 'Same Bank',
        }),
        bill('inactive', { productId: 'closed' }),
        bill('foreign', { productId: 'foreign' }),
        bill('long-card', { cardLast4: '1234567890123456' }),
        bill('wrong-currency', { currency: 'USD' }),
        bill('bad-date', { dueDate: '2026-02-31' }),
      ]);
      assert.deepEqual(
        response.body.results.map((r) => r.status),
        ['unmatched', 'unmatched', 'unmatched', 'invalid', 'invalid', 'invalid']
      );
      assert.equal(await currentRevision(pool, owner), before);
    });
    it('keeps the current bill when older mail arrives late', async () => {
      await post([
        bill('older', {
          dueDate: '2026-10-23',
          statementDate: '2026-10-05',
          statementBalance: 50,
          receivedAt: '2026-11-07T00:00:00Z',
        }),
      ]);
      assert.equal(
        (await pool.query("SELECT statement_balance FROM credit_products WHERE id='a'")).rows[0]
          .statement_balance,
        120
      );
    });
    it('syncs bill history and preserves it plus omitted delivery fields for an old client', async () => {
      const cols = await loadColumns(pool);
      const snapshot = await readSnapshot(pool, cols, owner);
      assert.equal(snapshot.tables.bill_statements.length, 4);
      delete snapshot.tables.bill_statements;
      for (const card of snapshot.tables.credit_products) {
        delete card.billEmail;
        delete card.cardLast4;
      }
      await transaction(pool, (client) => replaceSnapshot(client, cols, owner, snapshot));
      const back = await readSnapshot(pool, cols, owner);
      assert.equal(back.tables.bill_statements.length, 4);
      assert.equal(
        back.tables.credit_products.find((card) => card.id === 'a').billEmail,
        'one@example.test'
      );
      assert.equal(back.tables.credit_products.find((card) => card.id === 'a').cardLast4, '1234');
      const forbidden = ['one@example.test', '1234567890123456', 'statementBalance'];
      for (const value of forbidden) assert.equal(JSON.stringify(events).includes(value), false);
    });
  }
);
