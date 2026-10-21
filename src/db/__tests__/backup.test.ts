import { BACKUP_SCHEMA, parseBackupPayload, pickColumns, RestoreError } from '../backup';

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
