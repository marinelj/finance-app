/**
 * Talks to the Finance API server (server/ in this repo). The server holds the PostgreSQL
 * credentials; the app only ever has the server's address and a sign-in token.
 */

export type SyncErrorCode =
  | 'badUrl'
  | 'network'
  | 'wrongCredentials'
  | 'signupClosed'
  | 'emailTaken'
  | 'tooManyAttempts'
  | 'signedOut'
  | 'invalid'
  | 'conflict'
  | 'tooLarge'
  | 'server';

export class SyncError extends Error {
  readonly code: SyncErrorCode;
  constructor(code: SyncErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'SyncError';
  }
}

export type SyncUser = { id: string; email: string; displayName: string | null };
export type Session = { token: string; user: SyncUser };

type Fetch = typeof fetch;

/**
 * Accepts "192.168.1.5:8787" or "http://host:8787/" and returns "http://host:8787".
 * Throws SyncError('badUrl') when it isn't an http(s) address.
 */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new SyncError('badUrl');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new SyncError('badUrl');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SyncError('badUrl');
  if (!url.hostname) throw new SyncError('badUrl');
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
}

const CODES: Record<string, SyncErrorCode> = {
  wrong_credentials: 'wrongCredentials',
  signup_closed: 'signupClosed',
  email_taken: 'emailTaken',
  too_many_attempts: 'tooManyAttempts',
  unauthorized: 'signedOut',
  invalid: 'invalid',
  invalid_json: 'invalid',
  conflict: 'conflict',
  too_large: 'tooLarge',
};

/** Maps an HTTP status and the server's `{ error }` body onto a SyncError code. */
export function errorFromResponse(status: number, body: unknown): SyncError {
  const error =
    body && typeof body === 'object' && 'error' in body ? String(body.error) : undefined;
  const message =
    body && typeof body === 'object' && 'message' in body ? String(body.message) : undefined;
  if (error && CODES[error]) return new SyncError(CODES[error], message);
  if (status === 401) return new SyncError('signedOut');
  if (status === 413) return new SyncError('tooLarge');
  return new SyncError('server', message ?? `HTTP ${status}`);
}

export function createSyncClient(baseUrl: string, fetchImpl: Fetch = fetch) {
  const base = normalizeServerUrl(baseUrl);

  async function request<T>(
    method: string,
    path: string,
    { body, token, timeoutMs = 30_000 }: { body?: unknown; token?: string; timeoutMs?: number } = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      throw new SyncError('network', error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    if (!response.ok) throw errorFromResponse(response.status, parsed);
    return parsed as T;
  }

  return {
    baseUrl: base,
    signIn: (email: string, password: string, device?: string) =>
      request<Session>('POST', '/api/auth/login', { body: { email, password, device } }),
    signUp: (email: string, password: string, device?: string) =>
      request<Session>('POST', '/api/auth/signup', { body: { email, password, device } }),
    signOut: (token: string) => request<{ ok: true }>('POST', '/api/auth/logout', { token }),
    me: (token: string) =>
      request<{ user: SyncUser; lastUpload: string | null }>('GET', '/api/me', { token }),
    upload: (token: string, payload: unknown) =>
      request<{ ok: true; rows: number }>('PUT', '/api/sync', {
        token,
        body: payload,
        timeoutMs: 120_000,
      }),
    download: (token: string) =>
      request<unknown>('GET', '/api/sync', { token, timeoutMs: 120_000 }),
  };
}

export type SyncClient = ReturnType<typeof createSyncClient>;
