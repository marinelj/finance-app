import { z } from 'zod';

import {
  dummyVerify,
  hashPassword,
  hashToken,
  newToken,
  Throttle,
  verifyPassword,
} from './auth.js';
import { transaction } from './db.js';
import { loadColumns, payloadSchema, readSnapshot, replaceSnapshot, SyncError } from './sync.js';

class HttpError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().max(100).optional(),
  device: z.string().trim().max(100).optional(),
});

// Postgres errors that mean the upload itself is bad, not the server.
const BAD_DATA_CODES = new Set([
  '22P02',
  '22007',
  '22008',
  '22003',
  '22001',
  '23502',
  '23503',
  '23514',
]);

/** Builds the request handler. Kept separate from listen() so tests can call it directly. */
export function createApp({ pool, config, log = console }) {
  const throttle = new Throttle();
  let columnsPromise;
  const columns = () => (columnsPromise ??= loadColumns(pool));

  async function readJson(req) {
    const limit = config.maxBodyMb * 1024 * 1024;
    const type = req.headers['content-type'] ?? '';
    if (!type.startsWith('application/json')) throw new HttpError(415, 'json_required');
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new HttpError(413, 'too_large');
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new HttpError(400, 'invalid_json');
    }
  }

  function parse(schema, body) {
    const result = schema.safeParse(body);
    if (!result.success) throw new HttpError(400, 'invalid', result.error.issues[0]?.message);
    return result.data;
  }

  async function startSession(userId, device) {
    const token = newToken();
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, device, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(days => $4))`,
      [userId, hashToken(token), device ?? null, config.sessionDays]
    );
    return token;
  }

  async function authenticate(req) {
    const match = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(req.headers.authorization ?? '');
    if (!match) throw new HttpError(401, 'unauthorized');
    const { rows } = await pool.query(
      `UPDATE sessions SET last_used_at = now()
        WHERE token_hash = $1 AND expires_at > now()
        RETURNING id, user_id`,
      [hashToken(match[1])]
    );
    if (rows.length === 0) throw new HttpError(401, 'unauthorized');
    return { sessionId: rows[0].id, userId: rows[0].user_id };
  }

  const userView = (row) => ({ id: row.id, email: row.email, displayName: row.display_name });

  const routes = {
    'GET /health': async () => ({ ok: true }),

    'POST /api/auth/signup': async (req) => {
      const input = parse(credentialsSchema, await readJson(req));
      if (config.signup === 'closed') throw new HttpError(403, 'signup_closed');
      return transaction(pool, async (client) => {
        // Serialise sign-ups so "first account only" can't race.
        await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
        if (config.signup === 'first') {
          const { rows } = await client.query('SELECT 1 FROM users LIMIT 1');
          if (rows.length > 0) throw new HttpError(403, 'signup_closed');
        }
        const existing = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [
          input.email,
        ]);
        if (existing.rows.length > 0) throw new HttpError(409, 'email_taken');
        const { rows } = await client.query(
          `INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3)
           RETURNING id, email, display_name`,
          [input.email, input.displayName ?? null, await hashPassword(input.password)]
        );
        const token = newToken();
        await client.query(
          `INSERT INTO sessions (user_id, token_hash, device, expires_at)
           VALUES ($1, $2, $3, now() + make_interval(days => $4))`,
          [rows[0].id, hashToken(token), input.device ?? null, config.sessionDays]
        );
        return { status: 201, body: { token, user: userView(rows[0]) } };
      });
    },

    'POST /api/auth/login': async (req) => {
      const input = parse(credentialsSchema, await readJson(req));
      const key = `${req.socket.remoteAddress}|${input.email}`;
      if (throttle.blocked(key)) throw new HttpError(429, 'too_many_attempts');
      const { rows } = await pool.query(
        'SELECT id, email, display_name, password_hash FROM users WHERE lower(email) = $1',
        [input.email]
      );
      const ok = rows[0]
        ? await verifyPassword(input.password, rows[0].password_hash)
        : await dummyVerify(input.password);
      if (!ok) {
        throttle.fail(key);
        throw new HttpError(401, 'wrong_credentials');
      }
      throttle.clear(key);
      return { token: await startSession(rows[0].id, input.device), user: userView(rows[0]) };
    },

    'POST /api/auth/logout': async (req) => {
      const { sessionId } = await authenticate(req);
      await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
      return { ok: true };
    },

    'GET /api/me': async (req) => {
      const { userId } = await authenticate(req);
      const { rows } = await pool.query(
        `SELECT u.id, u.email, u.display_name, s.exported_at, s.updated_at AS synced_at
           FROM users u LEFT JOIN sync_state s ON s.user_id = u.id WHERE u.id = $1`,
        [userId]
      );
      return {
        user: userView(rows[0]),
        lastUpload: rows[0].synced_at ?? null,
      };
    },

    'GET /api/sync': async (req) => {
      const { userId } = await authenticate(req);
      const cols = await columns();
      return transaction(pool, async (client) => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        return readSnapshot(client, cols, userId);
      });
    },

    'PUT /api/sync': async (req) => {
      const { userId } = await authenticate(req);
      const payload = parse(payloadSchema, await readJson(req));
      const cols = await columns();
      const count = await transaction(pool, async (client) => {
        // One upload at a time per user.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
        return replaceSnapshot(client, cols, userId, payload);
      });
      return { ok: true, rows: count };
    },
  };

  function cors(req, res) {
    const origin = req.headers.origin;
    if (!origin || !config.corsOrigins.includes(origin)) return;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  function send(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(text);
  }

  return async function handle(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const path = new URL(req.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/';
    const route = routes[`${req.method} ${path}`];
    try {
      if (!route) throw new HttpError(404, 'not_found');
      const result = await route(req);
      if (result && typeof result.status === 'number' && 'body' in result) {
        send(res, result.status, result.body);
      } else {
        send(res, 200, result);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        // The rest of an oversized body is still on the socket: don't reuse the connection.
        if (error.status === 413) res.setHeader('Connection', 'close');
        send(res, error.status, { error: error.code, message: error.message });
      } else if (error instanceof SyncError) {
        send(res, 400, { error: error.code, message: error.message });
      } else if (error?.code === '23505') {
        send(res, 409, { error: 'conflict', message: 'An item with the same id already exists.' });
      } else if (BAD_DATA_CODES.has(error?.code)) {
        send(res, 400, { error: 'invalid', message: error.message });
      } else {
        log.error(error);
        send(res, 500, { error: 'server_error' });
      }
    }
  };
}
