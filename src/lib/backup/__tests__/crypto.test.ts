import { randomBytes } from 'node:crypto';

import {
  BackupError,
  backupCreatedAt,
  decryptBackup,
  encryptBackup,
  fromBase64,
  toBase64,
  utf8Decode,
  utf8Encode,
} from '../crypto';

// Fast parameters for tests; the app uses DEFAULT_SCRYPT.
const scrypt = { N: 2 ** 10, r: 8, p: 1 };
const random = (length: number) => new Uint8Array(randomBytes(length));

describe('codecs', () => {
  it('round-trips base64, including padding', () => {
    for (const length of [0, 1, 2, 3, 4, 31, 64]) {
      const bytes = random(length);
      expect(fromBase64(toBase64(bytes))).toEqual(bytes);
      expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });

  it('rejects text that is not base64', () => {
    expect(() => fromBase64('abc')).toThrow();
    expect(() => fromBase64('ab$=')).toThrow();
  });

  it('encodes UTF-8 like the platform, including Chinese and emoji', () => {
    const text = 'Finance 财务 ¥1,234.56 💳';
    expect(utf8Encode(text)).toEqual(new Uint8Array(Buffer.from(text, 'utf8')));
    expect(utf8Decode(utf8Encode(text))).toBe(text);
  });
});

describe('backups', () => {
  const payload = JSON.stringify({ hello: '世界', amounts: [1, 2.5] });

  it('encrypts and decrypts with the passphrase', async () => {
    const file = await encryptBackup(payload, 'correct horse 电池', {
      randomBytes: random,
      now: new Date('2026-10-21T08:00:00Z'),
      scrypt,
    });
    expect(file).not.toContain('世界');
    expect(JSON.parse(file)).toMatchObject({
      app: 'finance-app',
      format: 1,
      createdAt: '2026-10-21T08:00:00.000Z',
      kdf: { name: 'scrypt', N: 1024, r: 8, p: 1 },
      cipher: { name: 'xchacha20poly1305' },
    });
    expect(backupCreatedAt(file)).toBe('2026-10-21T08:00:00.000Z');
    await expect(decryptBackup(file, 'correct horse 电池')).resolves.toBe(payload);
  });

  it('normalises the passphrase (full-width and composed characters)', async () => {
    const file = await encryptBackup(payload, 'ｐａｓｓ１２３', { randomBytes: random, scrypt });
    await expect(decryptBackup(file, 'pass123')).resolves.toBe(payload);
  });

  it('refuses a wrong passphrase or a modified file', async () => {
    const file = await encryptBackup(payload, 'right passphrase', { randomBytes: random, scrypt });
    await expect(decryptBackup(file, 'wrong passphrase')).rejects.toEqual(
      new BackupError('wrongPassphrase')
    );
    const envelope = JSON.parse(file);
    const data = fromBase64(envelope.data);
    data[0] ^= 1;
    const tampered = JSON.stringify({ ...envelope, data: toBase64(data) });
    await expect(decryptBackup(tampered, 'right passphrase')).rejects.toMatchObject({
      code: 'wrongPassphrase',
    });
  });

  it('recognises files that are not backups, or from a newer format', async () => {
    await expect(decryptBackup('not json', 'x')).rejects.toMatchObject({ code: 'notBackup' });
    await expect(decryptBackup('{"app":"other"}', 'x')).rejects.toMatchObject({
      code: 'notBackup',
    });
    const file = JSON.parse(await encryptBackup(payload, 'p', { randomBytes: random, scrypt }));
    await expect(decryptBackup(JSON.stringify({ ...file, format: 2 }), 'p')).rejects.toMatchObject({
      code: 'unsupported',
    });
    expect(backupCreatedAt('nope')).toBeNull();
  });

  it('uses a fresh salt and nonce every time', async () => {
    const a = JSON.parse(await encryptBackup(payload, 'p', { randomBytes: random, scrypt }));
    const b = JSON.parse(await encryptBackup(payload, 'p', { randomBytes: random, scrypt }));
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.nonce).not.toBe(b.cipher.nonce);
    expect(a.data).not.toBe(b.data);
  });
});
