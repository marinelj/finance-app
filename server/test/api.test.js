// Integration tests against a real PostgreSQL. Point TEST_DATABASE_URL at an empty database the
// test may wipe, e.g. postgres://finance_app@localhost:5432/finance_test. Skipped when unset.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';

import pg from 'pg';

import { createApp } from '../src/app.js';
import { migrate } from '../src/db.js';

const url = process.env.TEST_DATABASE_URL;

describe('API', { skip: !url && 'TEST_DATABASE_URL is not set' }, () => {
  let pool;
  let server;
  let base;

  const call = async (method, path, { body, token } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  const payload = (overrides = {}) => ({
    app: 'finance-app',
    schema: 3,
    exportedAt: '2026-11-01T10:00:00.000Z',
    tables: {
      custom_product_types: [],
      credit_products: [
        {
          id: 'p1',
          name: '招商银行信用卡',
          issuer: 'CMB',
          kind: 'credit_card',
          preset: 'credit_card',
          customTypeId: null,
          currency: 'CNY',
          color: '#c00',
          emoji: '💳',
          creditLimit: 50000,
          balance: 1234.56,
          statementBalance: null,
          minimumPayment: null,
          statementDay: 5,
          dueRule: 'fixed_day',
          dueDay: 23,
          dueDaysAfterStatement: null,
          hasGracePeriod: true,
          graceNote: null,
          interestRate: 0.05,
          interestRateUnit: 'daily',
          annualFee: null,
          feeWaiver: null,
          repaymentDay: null,
          loanPrincipal: null,
          loanStartDate: null,
          loanTermMonths: null,
          repaymentMethod: null,
          paidThrough: '2026-10-23',
          notes: null,
          isActive: true,
          createdAt: '2026-10-01T08:00:00.000Z',
          updatedAt: '2026-10-02T08:00:00.000Z',
        },
      ],
      installments: [
        {
          id: 'i1',
          productId: 'p1',
          seq: 1,
          dueDate: '2026-11-23',
          principal: 100,
          interest: 1.5,
          amount: 101.5,
          paidAt: '2026-10-20',
        },
      ],
      payments: [
        {
          id: 'pay1',
          productId: 'p1',
          date: '2026-10-20',
          amount: 500,
          forDueDate: '2026-10-23',
          installmentId: 'gone',
          note: null,
          balanceReduction: 500,
          previousPaidThrough: null,
          previousStatementBalance: null,
          createdAt: '2026-10-20T01:00:00.000Z',
        },
      ],
      fx_rates: [{ currency: 'CNY', unitsPerUsd: 7.12, updatedAt: '2026-10-01T00:00:00.000Z' }],
      stock_holdings: [
        {
          id: 's1',
          ticker: 'VTI',
          name: null,
          assetClass: 'domestic_equity',
          shares: 12.345678,
          price: 301.25,
          costBasis: null,
          dividendPerShare: 0.95,
          dividendFrequency: 4,
          firstPayMonth: 3,
          currency: 'USD',
          notes: null,
          createdAt: '2026-10-01T08:00:00.000Z',
          updatedAt: '2026-10-01T08:00:00.000Z',
        },
      ],
      net_worth_snapshots: [
        {
          month: '2026-10',
          assets: 100000,
          liabilities: 1234.56,
          netWorth: 98765.44,
          currency: 'CNY',
          updatedAt: '2026-10-31T00:00:00.000Z',
        },
      ],
      ...overrides.tables,
    },
    settings: { preferences: { language: 'zh-Hans', homeCurrency: 'CNY' }, demo: null },
    ...overrides.top,
  });

  before(async () => {
    pool = new pg.Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(pool);
    const config = {
      signup: 'first',
      corsOrigins: ['http://localhost:8081'],
      sessionDays: 90,
      maxBodyMb: 1,
    };
    server = createServer(createApp({ pool, config, log: { error() {} } }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server?.close();
    await pool?.end();
  });

  let token;

  it('lets the first account sign up, then closes sign-up', async () => {
    const first = await call('POST', '/api/auth/signup', {
      body: { email: 'Marine@Example.com', password: 'correct horse battery' },
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.user.email, 'marine@example.com');
    token = first.body.token;

    const second = await call('POST', '/api/auth/signup', {
      body: { email: 'other@example.com', password: 'another password' },
    });
    assert.equal(second.status, 403);
  });

  it('stores only a hash of the password and the token', async () => {
    const { rows } = await pool.query('SELECT password_hash FROM users');
    assert.match(rows[0].password_hash, /^scrypt\$/);
    const sessions = await pool.query('SELECT token_hash FROM sessions');
    assert.ok(sessions.rows.every((row) => row.token_hash !== token));
  });

  it('signs in with the right password only', async () => {
    const wrong = await call('POST', '/api/auth/login', {
      body: { email: 'marine@example.com', password: 'wrong password' },
    });
    assert.equal(wrong.status, 401);
    const right = await call('POST', '/api/auth/login', {
      body: { email: 'MARINE@example.com', password: 'correct horse battery' },
    });
    assert.equal(right.status, 200);
    assert.ok(right.body.token);
  });

  it('rejects requests without a valid token', async () => {
    assert.equal((await call('GET', '/api/sync')).status, 401);
    assert.equal((await call('GET', '/api/sync', { token: 'x'.repeat(43) })).status, 401);
  });

  it('round-trips an upload exactly', async () => {
    const sent = payload();
    const put = await call('PUT', '/api/sync', { body: sent, token });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.equal(put.body.rows, 6);

    const got = await call('GET', '/api/sync', { token });
    assert.equal(got.status, 200);
    assert.equal(got.body.schema, 3);
    assert.equal(got.body.exportedAt, sent.exportedAt);
    assert.deepEqual(got.body.settings, sent.settings);
    for (const [table, rows] of Object.entries(sent.tables)) {
      const back = got.body.tables[table].map((row) => {
        const { cardLast4, ...rest } = row;
        assert.equal(cardLast4 ?? null, null);
        return rest;
      });
      assert.deepEqual(back, rows, table);
    }
  });

  it('replaces everything on the next upload', async () => {
    const put = await call('PUT', '/api/sync', {
      body: payload({ tables: { credit_products: [], installments: [], payments: [] } }),
      token,
    });
    assert.equal(put.status, 200);
    const got = await call('GET', '/api/sync', { token });
    assert.equal(got.body.tables.credit_products.length, 0);
    assert.equal(got.body.tables.payments.length, 0);
    assert.equal(got.body.tables.stock_holdings.length, 1);
  });

  it('rejects bad data without changing what is stored', async () => {
    const bad = payload();
    bad.tables.credit_products = [{ ...bad.tables.credit_products[0], currency: 'XXX' }];
    const put = await call('PUT', '/api/sync', { body: bad, token });
    assert.equal(put.status, 400);
    const got = await call('GET', '/api/sync', { token });
    assert.equal(got.body.tables.credit_products.length, 0);
    assert.equal(got.body.tables.stock_holdings.length, 1);
  });

  it('refuses payments for products that are not in the upload', async () => {
    const put = await call('PUT', '/api/sync', {
      body: payload({ tables: { credit_products: [], installments: [] } }),
      token,
    });
    assert.equal(put.status, 400);
  });

  it('ignores a user_id sent by the client', async () => {
    const sneaky = payload();
    sneaky.tables.stock_holdings = [
      { ...sneaky.tables.stock_holdings[0], userId: '00000000-0000-0000-0000-000000000000' },
    ];
    const put = await call('PUT', '/api/sync', { body: sneaky, token });
    assert.equal(put.status, 200);
  });

  it('enforces the body size limit', async () => {
    const big = payload();
    big.settings.preferences = { blob: 'x'.repeat(2 * 1024 * 1024) };
    const put = await call('PUT', '/api/sync', { body: big, token });
    assert.equal(put.status, 413);
  });

  it('answers CORS only for listed origins', async () => {
    const ok = await fetch(`${base}/api/sync`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8081' },
    });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    const no = await fetch(`${base}/api/sync`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(no.headers.get('access-control-allow-origin'), null);
  });

  it('signs out', async () => {
    assert.equal((await call('POST', '/api/auth/logout', { token })).status, 200);
    assert.equal((await call('GET', '/api/me', { token })).status, 401);
  });
});
