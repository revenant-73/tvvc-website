import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminPasswordHash, normalizeLoginEmail, verifyAdminPassword } from '../src/lib/admin-password-hash.ts';

test('admin password hashes verify only the matching password', () => {
  const hash = createAdminPasswordHash('long unique password');

  assert.match(hash, /^scrypt:16384:8:1:[^:]+:[^:]+$/);
  assert.equal(verifyAdminPassword('long unique password', hash), true);
  assert.equal(verifyAdminPassword('wrong password', hash), false);
});

test('admin login email normalization trims and lowercases', () => {
  assert.equal(normalizeLoginEmail('  Admin@TVVC.TEST  '), 'admin@tvvc.test');
  assert.equal(normalizeLoginEmail(null), '');
});
