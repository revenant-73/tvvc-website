import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRevisionCharges, revisionAuthorizationText } from '../src/lib/club-season-plan-revision.ts';

test('accepts a future schedule that exactly matches the remaining balance', () => {
  const charges = normalizeRevisionCharges([
    { dueDate: '2027-04-05', amount: 11_000 },
    { dueDate: '2027-05-05', amount: 11_000 },
  ], '2027-03-10', 22_000);
  assert.equal(charges.length, 2);
  assert.match(revisionAuthorizationText(charges, 22_000), /\$220\.00/);
});

test('rejects stale, duplicate, unordered, and unreconciled schedules', () => {
  assert.throws(() => normalizeRevisionCharges([{ dueDate: '2027-03-10', amount: 22_000 }], '2027-03-10', 22_000), /DUE_DATE_NOT_FUTURE/);
  assert.throws(() => normalizeRevisionCharges([
    { dueDate: '2027-04-05', amount: 11_000 }, { dueDate: '2027-04-05', amount: 11_000 },
  ], '2027-03-10', 22_000), /DUPLICATE_DUE_DATE/);
  assert.throws(() => normalizeRevisionCharges([
    { dueDate: '2027-05-05', amount: 11_000 }, { dueDate: '2027-04-05', amount: 11_000 },
  ], '2027-03-10', 22_000), /DUE_DATES_NOT_ASCENDING/);
  assert.throws(() => normalizeRevisionCharges([{ dueDate: '2027-04-05', amount: 21_999 }], '2027-03-10', 22_000), /REVISION_TOTAL_MISMATCH/);
});
