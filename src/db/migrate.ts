import type { SQLiteDatabase } from 'expo-sqlite';

type MigrationBundle = {
  journal: { entries: { idx: number; when: number }[] };
  migrations: Record<string, string>;
};

/**
 * Keep Drizzle's journal, but run startup DDL through SQLite's async exec API. On web the
 * synchronous prepared-statement migrator can invalidate its transaction during first-run
 * schema creation, then hide the original failure behind a second ROLLBACK error.
 * DatabaseGate keeps every application query outside this transaction until it completes.
 */
export async function migrateDatabase(
  connection: Pick<
    SQLiteDatabase,
    'execAsync' | 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'
  >,
  bundle: MigrationBundle
): Promise<void> {
  await connection.execAsync(
    'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)'
  );
  const last = await connection.getFirstAsync<{ created_at: number }>(
    'SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1'
  );
  const pending = bundle.journal.entries.filter((entry) => entry.when > (last?.created_at ?? 0));
  if (!pending.length) return;
  await connection.withTransactionAsync(async () => {
    for (const entry of pending) {
      const source = bundle.migrations[`m${String(entry.idx).padStart(4, '0')}`];
      if (!source) throw new Error(`Missing database migration ${entry.idx}`);
      await connection.execAsync(source);
      await connection.runAsync(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        '',
        entry.when
      );
    }
  });
}
