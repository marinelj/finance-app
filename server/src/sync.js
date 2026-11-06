import { z } from 'zod';

/**
 * Sync uses the same payload as the app's encrypted backup (src/db/backup.ts): every table as
 * an array of rows keyed by the app's camelCase field names, plus a few settings. An upload
 * replaces everything the user has on the server; a download returns it in the same shape.
 */

/** Parents before children, matching the app's restore order. */
export const SYNC_TABLES = [
  'custom_product_types',
  'credit_products',
  'bill_statements',
  'installments',
  'payments',
  'fx_rates',
  'incomes',
  'housing',
  'insurance_policies',
  'expenses',
  'cash_accounts',
  'bond_holdings',
  'stock_holdings',
  'net_worth_snapshots',
];

/** Tables owned through their credit product rather than a user_id column. */
const CHILD_TABLES = new Set(['installments', 'payments']);
const PRODUCT_TABLES = new Set([...CHILD_TABLES, 'bill_statements']);

export const SETTING_KEYS = ['preferences', 'riskProfile', 'planner', 'demo'];

const MAX_ROWS_PER_TABLE = 50_000;

export const payloadSchema = z.object({
  app: z.literal('finance-app'),
  schema: z.number().int().positive(),
  exportedAt: z.string().datetime({ offset: true }),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown())).max(MAX_ROWS_PER_TABLE)),
  settings: z.record(z.string(), z.unknown()),
});

export const toSnake = (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
export const toCamel = (column) =>
  column.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());

/** Column names of each sync table, read once from the database. */
export async function loadColumns(pool) {
  const { rows } = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1) ORDER BY ordinal_position`,
    [SYNC_TABLES]
  );
  const columns = new Map(SYNC_TABLES.map((table) => [table, []]));
  for (const row of rows) columns.get(row.table_name).push(row.column_name);
  return columns;
}

const ownerFilter = (table) =>
  CHILD_TABLES.has(table)
    ? 'product_id IN (SELECT id FROM credit_products WHERE user_id = $1)'
    : 'user_id = $1';

export async function readSnapshot(client, columns, userId) {
  const tables = {};
  for (const table of SYNC_TABLES) {
    const cols = columns.get(table).filter((column) => column !== 'user_id');
    const list = cols.map((column) => `"${column}"`).join(', ');
    const { rows } = await client.query(
      `SELECT ${list} FROM ${table} WHERE ${ownerFilter(table)}`,
      [userId]
    );
    tables[table] = rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([column, value]) => [toCamel(column), value]))
    );
  }
  const { rows: settingRows } = await client.query(
    'SELECT key, value FROM settings WHERE user_id = $1 AND key = ANY($2)',
    [userId, SETTING_KEYS]
  );
  const { rows: state } = await client.query(
    'SELECT app_schema, exported_at, revision FROM sync_state WHERE user_id = $1',
    [userId]
  );
  return {
    app: 'finance-app',
    schema: state[0]?.app_schema ?? 1,
    exportedAt: state[0]?.exported_at ?? new Date(0).toISOString(),
    revision: state[0]?.revision ?? 0,
    tables,
    settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
  };
}

/** Rows for one table: known columns only, user_id set by the server, never by the client. */
export function rowsForInsert(table, rows, columns, userId) {
  const allowed = new Set(columns.filter((column) => column !== 'user_id'));
  const owned = columns.includes('user_id');
  return rows.map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      const column = toSnake(key);
      if (!allowed.has(column)) continue;
      out[column] = value === undefined ? null : value;
    }
    if (owned) out.user_id = userId;
    return out;
  });
}

async function insertRows(client, table, rows) {
  // Group rows by their column set so each INSERT has one shape.
  const groups = new Map();
  for (const row of rows) {
    const cols = Object.keys(row).sort();
    const key = cols.join(',');
    if (!groups.has(key)) groups.set(key, { cols, rows: [] });
    groups.get(key).rows.push(row);
  }
  for (const { cols, rows: group } of groups.values()) {
    if (cols.length === 0) continue;
    for (let i = 0; i < group.length; i += 500) {
      const chunk = group.slice(i, i + 500);
      const values = [];
      const tuples = chunk.map((row) => {
        const params = cols.map((column) => {
          values.push(row[column]);
          return `$${values.length}`;
        });
        return `(${params.join(', ')})`;
      });
      await client.query(
        `INSERT INTO ${table} (${cols.map((column) => `"${column}"`).join(', ')}) VALUES ${tuples.join(', ')}`,
        values
      );
    }
  }
}

export class SyncError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.code = code;
  }
}

/** The user's current revision: 0 before the first upload, then 1, 2, 3… */
export async function currentRevision(client, userId) {
  const { rows } = await client.query('SELECT revision FROM sync_state WHERE user_id = $1', [
    userId,
  ]);
  return rows[0]?.revision ?? 0;
}

/**
 * Replaces all of the user's data with the payload. Call inside a transaction. Returns the
 * number of rows stored and the new revision.
 */
export async function replaceSnapshot(client, columns, userId, payload) {
  // Old clients omit newly introduced fields/tables. Preserve those values before parent
  // replacement cascades, and retain server-owned email history for products still present.
  const { rows: existingProducts } = await client.query(
    'SELECT id, bill_email, card_last4 FROM credit_products WHERE user_id = $1',
    [userId]
  );
  const productById = new Map(existingProducts.map((row) => [row.id, row]));
  const incomingProducts = (payload.tables.credit_products ?? []).map((row) => {
    const stored = productById.get(row.id);
    return {
      ...row,
      billEmail: row.billEmail === undefined ? (stored?.bill_email ?? null) : row.billEmail,
      cardLast4: row.cardLast4 === undefined ? (stored?.card_last4 ?? null) : row.cardLast4,
    };
  });
  const incomingIds = new Set(incomingProducts.map((row) => row.id));
  const { rows: storedBills } = await client.query(
    'SELECT * FROM bill_statements WHERE user_id = $1',
    [userId]
  );
  const bills = new Map(
    (payload.tables.bill_statements ?? []).map((row) => [row.sourceMessageId, row])
  );
  for (const row of storedBills)
    bills.set(
      row.source_message_id,
      Object.fromEntries(
        Object.entries(row)
          .filter(([key]) => key !== 'user_id')
          .map(([key, value]) => [toCamel(key), value])
      )
    );
  if ((payload.tables.bill_statements ?? []).some((row) => !incomingIds.has(row.productId)))
    throw new SyncError('invalid', 'bill_statements refers to a product outside the upload');
  const preservedBills = [...bills.values()].filter((row) => incomingIds.has(row.productId));
  // Children go with their products (ON DELETE CASCADE).
  for (const table of [...SYNC_TABLES].reverse()) {
    if (CHILD_TABLES.has(table)) continue;
    await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
  }

  const productIds = new Set();
  let count = 0;
  for (const table of SYNC_TABLES) {
    const incoming =
      table === 'credit_products'
        ? incomingProducts
        : table === 'bill_statements'
          ? preservedBills
          : (payload.tables[table] ?? []);
    const rows = rowsForInsert(table, incoming, columns.get(table), userId);
    if (table === 'credit_products') for (const row of rows) productIds.add(row.id);
    if (PRODUCT_TABLES.has(table) && rows.some((row) => !productIds.has(row.product_id))) {
      // Only attach plans and payments to products in this same upload.
      throw new SyncError('invalid', `${table} refers to a product that isn't in the upload`);
    }
    await insertRows(client, table, rows);
    count += rows.length;
  }

  await client.query('DELETE FROM settings WHERE user_id = $1 AND key = ANY($2)', [
    userId,
    SETTING_KEYS,
  ]);
  for (const key of SETTING_KEYS) {
    if (payload.settings[key] === undefined) continue;
    await client.query('INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)', [
      userId,
      key,
      JSON.stringify(payload.settings[key]),
    ]);
  }

  const { rows: state } = await client.query(
    `INSERT INTO sync_state (user_id, app_schema, exported_at, revision) VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id) DO UPDATE
       SET app_schema = EXCLUDED.app_schema, exported_at = EXCLUDED.exported_at,
           revision = sync_state.revision + 1, updated_at = now()
     RETURNING revision`,
    [userId, payload.schema, payload.exportedAt]
  );
  return { count, revision: state[0].revision };
}
