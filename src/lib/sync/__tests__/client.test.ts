import { createSyncClient, errorFromResponse, normalizeServerUrl, SyncError } from '../client';

describe('normalizeServerUrl', () => {
  it('adds http:// and drops trailing slashes', () => {
    expect(normalizeServerUrl(' 192.168.1.5:8787/ ')).toBe('http://192.168.1.5:8787');
    expect(normalizeServerUrl('https://finance.example.com/api/')).toBe(
      'https://finance.example.com/api'
    );
  });

  it('rejects empty and non-http addresses', () => {
    expect(() => normalizeServerUrl('')).toThrow(SyncError);
    expect(() => normalizeServerUrl('ftp://host')).toThrow(SyncError);
  });
});

describe('errorFromResponse', () => {
  it('maps server error codes', () => {
    expect(errorFromResponse(401, { error: 'wrong_credentials' }).code).toBe('wrongCredentials');
    expect(errorFromResponse(403, { error: 'signup_closed' }).code).toBe('signupClosed');
    expect(errorFromResponse(401, null).code).toBe('signedOut');
    expect(errorFromResponse(500, { error: 'server_error' }).code).toBe('server');
  });
});

describe('createSyncClient', () => {
  const json = (status: number, body: unknown) =>
    ({ ok: status < 400, status, json: async () => body }) as Response;

  it('sends the token and JSON body', async () => {
    const fetchMock = jest.fn(async () => json(200, { ok: true, rows: 3 }));
    const client = createSyncClient('192.168.1.5:8787', fetchMock as unknown as typeof fetch);
    await expect(client.upload('tok', { a: 1 })).resolves.toEqual({ ok: true, rows: 3 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://192.168.1.5:8787/api/sync');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.body).toBe('{"a":1}');
  });

  it('turns failures into SyncErrors', async () => {
    const offline = createSyncClient('h:1', (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch);
    await expect(offline.download('tok')).rejects.toMatchObject({ code: 'network' });

    const denied = createSyncClient('h:1', (async () =>
      json(401, { error: 'unauthorized' })) as unknown as typeof fetch);
    await expect(denied.download('tok')).rejects.toMatchObject({ code: 'signedOut' });
  });
});
