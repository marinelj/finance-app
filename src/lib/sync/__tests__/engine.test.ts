import type { SyncAccount } from '../account';
import { SyncError, type SyncClient } from '../client';
import { fingerprint, isEmpty, localChange, SyncEngine, type Snapshot } from '../engine';

type Data = Snapshot;

const data = (incomes: number, netWorth = 0): Data => ({
  tables: {
    incomes: Array.from({ length: incomes }, (_, i) => ({ id: `i${i}`, amount: 100 + i })),
    net_worth_snapshots: netWorth ? [{ month: '2026-11', netWorth }] : [],
  },
  settings: { preferences: { homeCurrency: 'CNY' } },
});

/** A fake server and device wired into a SyncEngine. */
function setup(options: { server?: Data | null; serverRevision?: number; device?: Data } = {}) {
  const server = {
    data: options.server ?? null,
    revision: options.serverRevision ?? (options.server ? 1 : 0),
    uploads: 0,
    offline: false,
  };
  let device: Data = options.device ?? data(0);
  let account: SyncAccount | null = {
    serverUrl: 'https://api.example',
    token: 'tok',
    email: 'me@example.com',
    revision: null,
    syncedHash: null,
    lastSyncedAt: null,
  };

  const guard = () => {
    if (server.offline) throw new SyncError('network');
  };
  const client = {
    revision: jest.fn(async () => {
      guard();
      return server.revision;
    }),
    upload: jest.fn(async (_token: string, payload: object, base?: number) => {
      guard();
      if (base !== undefined && base !== server.revision) throw new SyncError('stale');
      server.data = structuredClone(payload as Data);
      server.revision += 1;
      server.uploads += 1;
      return { ok: true as const, rows: 0, revision: server.revision };
    }),
    download: jest.fn(async () => {
      guard();
      return { ...structuredClone(server.data ?? data(0)), revision: server.revision };
    }),
  } as unknown as SyncClient;

  const engine = new SyncEngine<Data>({
    readAccount: async () => account,
    saveAccount: async (next) => {
      account = next;
    },
    clearAccount: async () => {
      account = null;
    },
    createClient: () => client,
    collect: () => structuredClone(device),
    apply: (payload) => {
      const { tables, settings } = payload as Data;
      device = { tables, settings };
    },
    now: () => new Date('2026-11-02T10:00:00Z'),
  });

  return {
    engine,
    server,
    client,
    get device() {
      return device;
    },
    set device(next: Data) {
      device = next;
    },
    get account() {
      return account;
    },
  };
}

describe('fingerprint', () => {
  it('ignores row order and tells user data from derived tables', () => {
    const a = data(2, 500);
    const b = { ...a, tables: { ...a.tables, incomes: [...a.tables.incomes].reverse() } };
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(localChange(fingerprint(data(2, 600)), fingerprint(a))).toBe('derived');
    expect(localChange(fingerprint(data(3, 500)), fingerprint(a))).toBe('data');
    expect(localChange(fingerprint(a), fingerprint(a))).toBe('none');
    expect(isEmpty(data(0, 500))).toBe(true);
  });
});

describe('SyncEngine', () => {
  it('fills an empty server from this device on first sign-in', async () => {
    const t = setup({ device: data(2) });
    await t.engine.sync();
    expect(t.server.data).toEqual(data(2));
    expect(t.account?.revision).toBe(1);
    expect(t.engine.getStatus().phase).toBe('synced');
  });

  it('loads the server copy onto an empty device', async () => {
    const t = setup({ server: data(3), serverRevision: 4 });
    await t.engine.sync();
    expect(t.device).toEqual(data(3));
    expect(t.account?.revision).toBe(4);
  });

  it('asks before mixing a device with data and a server with data', async () => {
    const t = setup({ server: data(3), device: data(1) });
    await t.engine.sync();
    expect(t.engine.getStatus().phase).toBe('conflict');
    expect(t.server.uploads).toBe(0);
    await t.engine.resolve('server');
    expect(t.device).toEqual(data(3));
    expect(t.engine.getStatus().phase).toBe('synced');
  });

  it('saves local edits automatically and only when something changed', async () => {
    const t = setup({ device: data(1) });
    await t.engine.sync();
    expect(t.server.uploads).toBe(1);

    await t.engine.sync({ checkServer: false });
    expect(t.client.revision).toHaveBeenCalledTimes(1);

    t.device = data(2);
    await t.engine.sync({ checkServer: false });
    expect(t.server.uploads).toBe(2);
    expect(t.server.data).toEqual(data(2));
  });

  it('picks up changes saved by another device', async () => {
    const t = setup({ device: data(1) });
    await t.engine.sync();
    t.server.data = data(5);
    t.server.revision += 1;
    await t.engine.sync();
    expect(t.device).toEqual(data(5));
    expect(t.server.uploads).toBe(1);
  });

  it('lets the server win when only derived net-worth figures changed here', async () => {
    const t = setup({ device: data(1) });
    await t.engine.sync();
    t.device = data(1, 999);
    t.server.data = data(4);
    t.server.revision += 1;
    await t.engine.sync();
    expect(t.engine.getStatus().phase).toBe('synced');
    expect(t.device).toEqual(data(4));
  });

  it('pauses on a real conflict and keeps this device when asked', async () => {
    const t = setup({ device: data(1) });
    await t.engine.sync();
    t.device = data(2);
    t.server.data = data(7);
    t.server.revision += 1;
    await t.engine.sync();
    expect(t.engine.getStatus().phase).toBe('conflict');
    expect(t.server.data).toEqual(data(7));

    await t.engine.sync();
    expect(t.engine.getStatus().phase).toBe('conflict');

    await t.engine.resolve('device');
    expect(t.server.data).toEqual(data(2));
    expect(t.engine.getStatus().phase).toBe('synced');
  });

  it('keeps edits while offline and saves them when back', async () => {
    const t = setup({ device: data(1) });
    await t.engine.sync();
    t.server.offline = true;
    t.device = data(3);
    await t.engine.sync({ checkServer: false });
    expect(t.engine.getStatus().phase).toBe('offline');
    expect(t.device).toEqual(data(3));

    t.server.offline = false;
    await t.engine.sync();
    expect(t.server.data).toEqual(data(3));
    expect(t.engine.getStatus().phase).toBe('synced');
  });

  it('refills a server whose database was reset', async () => {
    const t = setup({ device: data(2) });
    await t.engine.sync();
    t.server.data = null;
    t.server.revision = 0;
    await t.engine.sync();
    expect(t.server.data).toEqual(data(2));
    expect(t.device).toEqual(data(2));
  });

  it('signs out when the server no longer accepts the token', async () => {
    const t = setup({ device: data(1) });
    (t.client.revision as jest.Mock).mockRejectedValueOnce(new SyncError('signedOut'));
    await t.engine.sync();
    expect(t.account).toBeNull();
    expect(t.engine.getStatus().phase).toBe('off');
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('keeps a card edit made while checking the server revision', async () => {
  const t = setup({ device: data(1) });
  await t.engine.sync();
  const revision = deferred<number>();
  (t.client.revision as jest.Mock).mockReturnValueOnce(revision.promise);
  const pass = t.engine.sync();
  await Promise.resolve();
  t.device = {
    ...data(1),
    tables: {
      ...data(1).tables,
      credit_products: [
        {
          id: 'card',
          name: 'Edited synthetic card',
          balance: 123,
          statementDay: 6,
          dueDay: 24,
          hasGracePeriod: true,
          interestRateUnit: 'daily',
        },
      ],
    },
  };
  revision.resolve(t.server.revision);
  await pass;
  expect(t.server.data).toEqual(t.device);
});

it('never overwrites an edit made while downloading a newer server snapshot', async () => {
  const t = setup({ device: data(1) });
  await t.engine.sync();
  t.server.data = data(3);
  t.server.revision++;
  const download = deferred<Data & { revision: number }>();
  (t.client.download as jest.Mock).mockReturnValueOnce(download.promise);
  const pass = t.engine.sync();
  while (!(t.client.download as jest.Mock).mock.calls.length) await Promise.resolve();
  t.device = data(2);
  download.resolve({ ...data(3), revision: t.server.revision });
  await pass;
  expect(t.device).toEqual(data(2));
  expect(t.engine.getStatus().phase).toBe('conflict');
});

it('preserves all edited product fields through upload, reload, and foreground checks', async () => {
  const t = setup({ device: data(1) });
  await t.engine.sync();
  const product = {
    id: 'card',
    name: 'Synthetic card',
    balance: 100,
    statementDay: 2,
    dueDay: 22,
    dueRule: 'fixed_day',
    dueDaysAfterStatement: null,
    hasGracePeriod: true,
    graceNote: 'Synthetic grace rule',
    interestRate: 12,
    interestRateUnit: 'apr',
  };
  t.device = { ...data(1), tables: { ...data(1).tables, credit_products: [product] } };
  await t.engine.sync({ checkServer: false });
  await t.engine.load();
  await t.engine.sync();
  await t.engine.sync();
  expect(t.server.data?.tables.credit_products[0]).toEqual(product);
  expect(t.device.tables.credit_products[0]).toEqual(product);
  expect(t.engine.getStatus().phase).toBe('synced');
});
