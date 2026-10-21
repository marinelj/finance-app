import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';

/**
 * Passphrase-encrypted backups. The file is a small JSON envelope:
 *
 *   { app, format, createdAt, kdf: { scrypt N/r/p + salt }, cipher: { xchacha20poly1305 + nonce },
 *     data: base64(ciphertext with its Poly1305 tag) }
 *
 * The key comes from scrypt over the NFKC-normalised passphrase; XChaCha20-Poly1305 encrypts and
 * authenticates the payload, so a wrong passphrase or a modified file fails to open instead of
 * yielding garbage. Nothing here touches the network or the platform: random bytes come in from
 * the caller (expo-crypto on device).
 */

export const BACKUP_APP = 'finance-app';
export const BACKUP_FORMAT = 1;

export type ScryptParams = { N: number; r: number; p: number };

/** 64 MiB of memory per attempt: slow to brute-force, a couple of seconds on a phone. */
export const DEFAULT_SCRYPT: ScryptParams = { N: 2 ** 16, r: 8, p: 1 };

type Envelope = {
  app: typeof BACKUP_APP;
  format: number;
  createdAt: string;
  kdf: { name: 'scrypt'; salt: string } & ScryptParams;
  cipher: { name: 'xchacha20poly1305'; nonce: string };
  data: string;
};

export type BackupErrorCode = 'notBackup' | 'unsupported' | 'wrongPassphrase';

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  constructor(code: BackupErrorCode) {
    super(code);
    this.code = code;
    this.name = 'BackupError';
  }
}

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 24;

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  params: ScryptParams,
  onProgress?: (fraction: number) => void
): Promise<Uint8Array> {
  return scryptAsync(utf8Encode(passphrase.normalize('NFKC')), salt, {
    ...params,
    dkLen: KEY_LENGTH,
    maxmem: 256 * 1024 * 1024,
    asyncTick: 16,
    onProgress,
  });
}

export async function encryptBackup(
  plaintext: string,
  passphrase: string,
  options: {
    randomBytes: (length: number) => Uint8Array;
    now?: Date;
    scrypt?: ScryptParams;
    onProgress?: (fraction: number) => void;
  }
): Promise<string> {
  const params = options.scrypt ?? DEFAULT_SCRYPT;
  const salt = options.randomBytes(SALT_LENGTH);
  const nonce = options.randomBytes(NONCE_LENGTH);
  const key = await deriveKey(passphrase, salt, params, options.onProgress);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(utf8Encode(plaintext));
  const envelope: Envelope = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    createdAt: (options.now ?? new Date()).toISOString(),
    kdf: { name: 'scrypt', salt: toBase64(salt), ...params },
    cipher: { name: 'xchacha20poly1305', nonce: toBase64(nonce) },
    data: toBase64(ciphertext),
  };
  return JSON.stringify(envelope);
}

function readEnvelope(text: string): Envelope {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupError('notBackup');
  }
  const envelope = value as Partial<Envelope> | null;
  if (!envelope || envelope.app !== BACKUP_APP || typeof envelope.data !== 'string') {
    throw new BackupError('notBackup');
  }
  if (
    envelope.format !== BACKUP_FORMAT ||
    envelope.kdf?.name !== 'scrypt' ||
    envelope.cipher?.name !== 'xchacha20poly1305'
  ) {
    throw new BackupError('unsupported');
  }
  return envelope as Envelope;
}

/** When the backup was made, without decrypting it (for showing the picked file). */
export function backupCreatedAt(text: string): string | null {
  try {
    return readEnvelope(text).createdAt;
  } catch {
    return null;
  }
}

export async function decryptBackup(
  text: string,
  passphrase: string,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const envelope = readEnvelope(text);
  const { N, r, p } = envelope.kdf;
  let salt: Uint8Array;
  let nonce: Uint8Array;
  let data: Uint8Array;
  try {
    salt = fromBase64(envelope.kdf.salt);
    nonce = fromBase64(envelope.cipher.nonce);
    data = fromBase64(envelope.data);
  } catch {
    throw new BackupError('notBackup');
  }
  const key = await deriveKey(passphrase, salt, { N, r, p }, onProgress);
  try {
    return utf8Decode(xchacha20poly1305(key, nonce).decrypt(data));
  } catch {
    // A wrong passphrase and a tampered file look the same: the authentication tag fails.
    throw new BackupError('wrongPassphrase');
  }
}

/* Small, dependency-free codecs, so the format does not depend on platform globals. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += ALPHABET[(triple >> 18) & 63] + ALPHABET[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[triple & 63] : '=';
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/\s/g, '');
  if (clean.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(clean)) throw new Error('Invalid base64');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const values = [0, 1, 2, 3].map((k) =>
      clean[i + k] === '=' ? 0 : ALPHABET.indexOf(clean[i + k])
    );
    const triple = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
    if (j < bytes.length) bytes[j++] = (triple >> 16) & 255;
    if (j < bytes.length) bytes[j++] = (triple >> 8) & 255;
    if (j < bytes.length) bytes[j++] = triple & 255;
  }
  return bytes;
}

export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63)
      );
    }
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const byte = bytes[i];
    let code: number;
    if (byte < 0x80) {
      code = byte;
      i += 1;
    } else if (byte >> 5 === 0x6) {
      code = ((byte & 31) << 6) | (bytes[i + 1] & 63);
      i += 2;
    } else if (byte >> 4 === 0xe) {
      code = ((byte & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
      i += 3;
    } else {
      code =
        ((byte & 7) << 18) |
        ((bytes[i + 1] & 63) << 12) |
        ((bytes[i + 2] & 63) << 6) |
        (bytes[i + 3] & 63);
      i += 4;
    }
    out += String.fromCodePoint(code);
  }
  return out;
}
