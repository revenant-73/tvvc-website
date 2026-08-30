import { createHash, randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-admin-password.mjs "your long admin password"');
  process.exit(1);
}

const salt = randomBytes(16).toString('base64url');
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('base64url');

console.log(`ADMIN_PASSWORD_LOGIN_HASH=scrypt:16384:8:1:${salt}:${hash}`);
console.log(`# fingerprint=${createHash('sha256').update(hash).digest('hex').slice(0, 12)}`);
