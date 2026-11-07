import { getTableName, type Table } from 'drizzle-orm';
import { getDb } from '../client';

import {
  BACKUP_SCHEMA,
  collectBackup,
  parseBackupPayload,
  pickColumns,
  restoreBackup,
  RestoreError,
} from '../backup';

jest.mock('../client', () => ({ getDb: jest.fn() }));

describe('backup payloads', () => {
  const payload = {
    app: 'finance-app',
    schema: BACKUP_SCHEMA,
    exportedAt: '2026-10-21T08:00:00.000Z',
    tables: { incomes: [{ id: 'a', name: 'Salary', amount: 30000 }] },
    settings: { preferences: { language: 'zh-Hans' } },
  };

  it('accepts a backup from this version or an older one', () => {
    expect(parseBackupPayload(JSON.stringify(payload)).tables.incomes).toHaveLength(1);
    expect(parseBackupPayload(JSON.stringify({ ...payload, schema: 1 })).schema).toBe(1);
  });

  it('refuses one from a newer version of the app', () => {
    expect(() =>
      parseBackupPayload(JSON.stringify({ ...payload, schema: BACKUP_SCHEMA + 1 }))
    ).toThrow(new RestoreError('newerVersion'));
  });

  it('refuses anything that is not a backup', () => {
    expect(() => parseBackupPayload('nope')).toThrow(new RestoreError('invalid'));
    expect(() => parseBackupPayload(JSON.stringify({ ...payload, app: 'other' }))).toThrow(
      new RestoreError('invalid')
    );
    expect(() =>
      parseBackupPayload(JSON.stringify({ ...payload, tables: { incomes: 'x' } }))
    ).toThrow(new RestoreError('invalid'));
  });

  it('drops keys that are not columns', () => {
    expect(pickColumns({ id: 'a', name: 'Salary', legacy: true }, ['id', 'name'])).toEqual({
      id: 'a',
      name: 'Salary',
    });
  });
});

it('collects, parses and restores courtesy days through the schema-driven backup path', () => {
  const rows: Record<string, Record<string, unknown>[]> = {
    credit_products: [{ id: 'synthetic', courtesyDays: 3 }],
    settings: [],
  };
  const db = {
    select: () => ({ from: (table: Table) => ({ all: () => rows[getTableName(table)] ?? [] }) }),
    delete: (table: Table) => ({
      run: () => {
        rows[getTableName(table)] = [];
      },
    }),
    insert: (table: Table) => ({
      values: (values: Record<string, unknown>[]) => ({
        run: () => {
          rows[getTableName(table)].push(...values);
        },
      }),
    }),
    transaction: (work: (tx: unknown) => void) => work(db),
  };
  (getDb as jest.Mock).mockReturnValue(db);
  const payload = parseBackupPayload(JSON.stringify(collectBackup()));
  expect(payload.tables.credit_products[0].courtesyDays).toBe(3);
  restoreBackup(payload);
  expect(rows.credit_products[0].courtesyDays).toBe(3);
  delete payload.tables.credit_products[0].courtesyDays;
  restoreBackup(parseBackupPayload(JSON.stringify(payload)));
  expect(rows.credit_products[0].courtesyDays ?? null).toBeNull();
});
