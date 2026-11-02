import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';

import { createApp } from '../src/app.js';
import { createCodexProxy } from '../src/codex-proxy.js';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

describe('Codex gateway mount', () => {
  let provider;
  let upstream;
  let base;
  let seen;

  before(async () => {
    upstream = createServer(async (req, res) => {
      let body = '';
      try {
        for await (const chunk of req) body += chunk;
      } catch {
        return; // Oversized requests are deliberately disconnected by the provider.
      }
      seen = { method: req.method, url: req.url, headers: req.headers, body };
      const authorized = req.headers.authorization === 'Bearer codex-token';
      res.writeHead(authorized ? 202 : 401, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(authorized ? { Location: '/codex/v1/runs/run_123' } : {}),
      });
      res.end(JSON.stringify({ status: authorized ? 'running' : 'unauthorized' }));
    });
    const origin = await listen(upstream);
    const app = createApp({
      pool: {
        query() {
          throw new Error('Proxy must not use the Finance database');
        },
      },
      config: { codexUpstream: origin, corsOrigins: ['https://client.example'] },
    });
    provider = createServer(app);
    base = await listen(provider);
  });

  after(async () => {
    await Promise.all(
      [provider, upstream].map((server) => new Promise((resolve) => server.close(resolve)))
    );
  });

  it('forwards paths, query, body, token and idempotency key', async () => {
    const body = JSON.stringify({ prompt: 'hello', thread_id: null });
    const res = await fetch(`${base}/codex/v1/runs?after=7`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer codex-token',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'request-1',
      },
      body,
    });
    assert.equal(res.status, 202);
    assert.equal(res.headers.get('location'), '/codex/v1/runs/run_123');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(seen.url, '/v1/runs?after=7');
    assert.equal(seen.method, 'POST');
    assert.equal(seen.headers.authorization, 'Bearer codex-token');
    assert.equal(seen.headers['idempotency-key'], 'request-1');
    assert.equal(seen.body, body);
    await res.json();
  });

  it('preserves upstream authorization errors', async () => {
    const res = await fetch(`${base}/codex/v1/runs`, {
      headers: { Authorization: 'Bearer finance-token' },
    });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).status, 'unauthorized');
  });

  it('keeps Finance health and unknown-route behavior', async () => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    assert.equal((await fetch(`${base}/codex-unrelated`)).status, 404);
  });

  it('supports browser preflight with idempotency headers', async () => {
    const res = await fetch(`${base}/codex/v1/runs`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://client.example' },
    });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('access-control-allow-headers'), /Idempotency-Key/);
  });

  it('rejects oversized forwarded requests', async () => {
    const res = await fetch(`${base}/codex/v1/runs`, {
      method: 'POST',
      body: 'x'.repeat(600000),
    });
    assert.equal(res.status, 413);
    await res.json();
  });

  it('returns 502 when the gateway is unavailable', async () => {
    const unused = createServer();
    const origin = await listen(unused);
    await new Promise((resolve) => unused.close(resolve));
    const server = createServer((req, res) => createCodexProxy(origin)(req, res));
    const local = await listen(server);
    try {
      const res = await fetch(`${local}/codex/healthz`);
      assert.equal(res.status, 502);
      assert.equal((await res.json()).error.code, 'codex_upstream_unavailable');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('disables the mount without configuration and rejects external targets', () => {
    assert.equal(createCodexProxy(), null);
    for (const target of [
      'http://example.com',
      'https://localhost',
      'http://localhost/path',
      'http://user:pass@localhost',
    ]) {
      assert.throws(() => createCodexProxy(target), /loopback HTTP origin/);
    }
  });
});
