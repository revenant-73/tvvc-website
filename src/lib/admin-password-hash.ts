import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEY_LENGTH = 64;

type PasswordHash = {
  n: number;
  r: number;
  p: number;
  salt: string;
  hash: string;
};

function envValue(key: string) {
  const astroEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return astroEnv?.[key] || process.env[key] || '';
}

export function normalizeLoginEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function createAdminPasswordHash(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH, { N: 16384, r: 8, p: 1 }).toString('base64url');
  return `scrypt:16384:8:1:${salt}:${hash}`;
}

function parsePasswordHash(value: string): PasswordHash | null {
  const [algorithm, n, r, p, salt, hash] = value.split(':');
  if (algorithm !== 'scrypt' || !salt || !hash) return null;

  const parsed = {
    n: Number(n),
    r: Number(r),
    p: Number(p),
    salt,
    hash,
  };

  return Number.isInteger(parsed.n)
    && Number.isInteger(parsed.r)
    && Number.isInteger(parsed.p)
    && parsed.n > 0
    && parsed.r > 0
    && parsed.p > 0
    ? parsed
    : null;
}

export function verifyAdminPassword(password: unknown, configuredHash = envValue('ADMIN_PASSWORD_LOGIN_HASH')) {
  if (typeof password !== 'string' || !password || !configuredHash) return false;

  const parsed = parsePasswordHash(configuredHash);
  if (!parsed) {
    console.error('ADMIN_PASSWORD_LOGIN_HASH is not a valid scrypt hash.');
    return false;
  }

  try {
    const expected = Buffer.from(parsed.hash, 'base64url');
    const actual = scryptSync(password, parsed.salt, expected.length, {
      N: parsed.n,
      r: parsed.r,
      p: parsed.p,
    });

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch (error) {
    console.error('Admin password verification failed:', error);
    return false;
  }
}
