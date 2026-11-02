import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// OWASP's recommended scrypt minimum: N=2^17, r=8, p=1 (128 MiB and about a quarter second
// per hash). Fine for a server that signs in a handful of people.
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const MAXMEM = 256 * 1024 * 1024;

/** "scrypt$N$r$p$salt$hash", salt and hash in base64url. */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return timingSafeEqual(key, expected);
}

// Compared against when the email is unknown, so both cases take the same time.
let dummyHash;
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword('not-a-real-password');
  await verifyPassword(password, dummyHash);
  return false;
}

export function newToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/** Counts failed sign-ins per key and blocks after `limit` in `windowMs`. In memory only. */
export class Throttle {
  constructor({ limit = 10, windowMs = 15 * 60 * 1000, now = () => Date.now() } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.failures = new Map();
  }

  blocked(key) {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (this.now() - entry.start > this.windowMs) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= this.limit;
  }

  fail(key) {
    const entry = this.failures.get(key);
    if (!entry || this.now() - entry.start > this.windowMs) {
      this.failures.set(key, { start: this.now(), count: 1 });
    } else {
      entry.count += 1;
    }
  }

  clear(key) {
    this.failures.delete(key);
  }
}
