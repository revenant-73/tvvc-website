import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeDatabaseUrl } from '../src/db/index.ts';

test('normalizes bare Turso hostnames for the LibSQL client', () => {
  assert.equal(
    normalizeDatabaseUrl('tvvc-registration-loren.aws-us-west-2.turso.io'),
    'libsql://tvvc-registration-loren.aws-us-west-2.turso.io'
  );
});

test('preserves explicit and local database URLs', () => {
  assert.equal(normalizeDatabaseUrl(' libsql://example.turso.io '), 'libsql://example.turso.io');
  assert.equal(normalizeDatabaseUrl('https://example.turso.io'), 'https://example.turso.io');
  assert.equal(normalizeDatabaseUrl('file:./local.db'), 'file:./local.db');
  assert.equal(normalizeDatabaseUrl(':memory:'), ':memory:');
});
