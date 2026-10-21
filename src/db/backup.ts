import { getTableColumns, type Table } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from './client';
import journal from '../../drizzle/meta/_journal.json';
import {
  bondHoldings,
  cashAccounts,
  creditProducts,
  customProductTypes,
  expenses,
  fxRates,
  housing,
  incomes,
  installments,
  insurancePolicies,
  netWorthSnapshots,
  payments,
  settings,
  stockHoldings,
} from './schema';

/**
 * What goes into a backup: every table, plus the settings that describe the user's data
 * (preferences, risk answers, planner thresholds, demo bookkeeping). App-lock settings live in
 * the keychain and stay on the device.
 */

/** Parents before children, so foreign keys hold while restoring. */
const TABLES: [string, Table][] = [
  ['custom_product_types', customProductTypes],
  ['credit_products', creditProducts],
  ['installments', installments],
  ['payments', payments],
  ['fx_rates', fxRates],
  ['incomes', incomes],
  ['housing', housing],
  ['insurance_policies', insurancePolicies],
  ['expenses', expenses],
  ['cash_accounts', cashAccounts],
  ['bond_holdings', bondHoldings],
  ['stock_holdings', stockHoldings],
  ['net_worth_snapshots', netWorthSnapshots],
];

const SETTING_KEYS = ['preferences', 'riskProfile', 'planner', 'demo'];

/** The number of migrations: a backup from a newer app version cannot be restored here. */
export const BACKUP_SCHEMA = journal.entries.length;

const payloadSchema = z.object({
  app: z.literal('finance-app'),
  schema: z.number().int().positive(),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  settings: z.record(z.string(), z.unknown()),
});

export type BackupPayload = z.infer<typeof payloadSchema>;

export class RestoreError extends Error {
  readonly code: 'invalid' | 'newerVersion';
  constructor(code: 'invalid' | 'newerVersion') {
    super(code);
    this.code = code;
    this.name = 'RestoreError';
  }
}

export function collectBackup(now: Date = new Date()): BackupPayload {
  const db = getDb();
  const tables = Object.fromEntries(
    TABLES.map(([name, table]) => [
      name,
      db.select().from(table).all() as Record<string, unknown>[],
    ])
  );
  const stored = db.select().from(settings).all();
  const settingValues = Object.fromEntries(
    stored
      .filter((row) => SETTING_KEYS.includes(row.key))
      .map((row) => {
        try {
          return [row.key, JSON.parse(row.value)];
        } catch {
          return [row.key, null];
        }
      })
  );
  return {
    app: 'finance-app',
    schema: BACKUP_SCHEMA,
    exportedAt: now.toISOString(),
    tables,
    settings: settingValues,
  };
}

/** Validates decrypted backup text; throws RestoreError when it cannot be restored here. */
export function parseBackupPayload(text: string): BackupPayload {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new RestoreError('invalid');
  }
  const result = payloadSchema.safeParse(value);
  if (!result.success) throw new RestoreError('invalid');
  if (result.data.schema > BACKUP_SCHEMA) throw new RestoreError('newerVersion');
  return result.data;
}

/** Keeps only the keys that are columns of the table (older or newer backups may differ). */
export function pickColumns(
  row: Record<string, unknown>,
  columns: readonly string[]
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => columns.includes(key)));
}

/** Replaces everything on this phone with the backup, in one transaction. Returns rows restored. */
export function restoreBackup(payload: BackupPayload): number {
  let restored = 0;
  getDb().transaction((tx) => {
    for (const [, table] of [...TABLES].reverse()) tx.delete(table).run();
    for (const [name, table] of TABLES) {
      const columns = Object.keys(getTableColumns(table));
      const rows = (payload.tables[name] ?? []).map((row) => pickColumns(row, columns));
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        // Rows were written by this app's own schema; columns are filtered above.
        tx.insert(table)
          .values(chunk as never)
          .run();
      }
      restored += rows.length;
    }
    for (const key of SETTING_KEYS) {
      const value = payload.settings[key];
      if (value === undefined) continue;
      const json = JSON.stringify(value);
      tx.insert(settings)
        .values({ key, value: json })
        .onConflictDoUpdate({ target: settings.key, set: { value: json } })
        .run();
    }
  });
  return restored;
}
