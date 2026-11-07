import migrations from '../../../drizzle/migrations';

import { migrateDatabase } from '../migrate';

const bundle = {
  journal: {
    entries: [
      { idx: 0, when: 1 },
      { idx: 1, when: 2 },
    ],
  },
  migrations: {
    m0000: 'CREATE TABLE first (id TEXT)',
    m0001: 'ALTER TABLE first ADD COLUMN value TEXT',
  },
};

function connection() {
  let committed = 0;
  const db = {
    execAsync: jest.fn(async (_sql: string) => {}),
    getFirstAsync: jest.fn(async () => (committed ? { created_at: committed } : null)),
    runAsync: jest.fn(async (_sql: string, _hash: string, version: number) => {
      committed = version;
    }),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => {
      const before = committed;
      try {
        await work();
      } catch (error) {
        committed = before;
        throw error;
      }
    }),
  };
  return db as unknown as Parameters<typeof migrateDatabase>[0] & typeof db;
}

it('opens a brand-new schema in one async transaction and skips it on the next open', async () => {
  const db = connection();
  await migrateDatabase(db, bundle);
  expect(db.execAsync).toHaveBeenCalledWith(bundle.migrations.m0000);
  expect(db.execAsync).toHaveBeenCalledWith(bundle.migrations.m0001);
  expect(db.runAsync).toHaveBeenCalledTimes(2);
  await migrateDatabase(db, bundle);
  expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
});

it('keeps the migration retryable when schema creation fails', async () => {
  const db = connection();
  db.execAsync
    .mockImplementationOnce(async () => {})
    .mockRejectedValueOnce(new Error('schema failed'));
  await expect(migrateDatabase(db, bundle)).rejects.toThrow('schema failed');
  await migrateDatabase(db, bundle);
  expect(db.runAsync).toHaveBeenCalledTimes(2);
});

it('upgrades an existing schema with the bundled courtesy column once', async () => {
  const db = connection();
  const entries = migrations.journal.entries;
  db.getFirstAsync.mockResolvedValueOnce({ created_at: entries[entries.length - 2].when });
  await migrateDatabase(db, migrations);
  expect(db.execAsync).toHaveBeenCalledWith(
    expect.stringContaining('ADD COLUMN courtesy_days integer CHECK')
  );
  expect(db.runAsync).toHaveBeenCalledTimes(1);
  await migrateDatabase(db, migrations);
  expect(db.runAsync).toHaveBeenCalledTimes(1);
});
