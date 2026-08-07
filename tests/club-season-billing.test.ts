import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, reminderDate, retryDate } from '../src/lib/club-season-billing-dates.ts';

test('January reminder waits until January 2 for the holiday pause', () => {
  assert.equal(reminderDate('2027-01-05'), '2027-01-02');
});

test('other reminders are sent five days before the charge', () => {
  assert.equal(reminderDate('2027-02-05'), '2027-01-31');
  assert.equal(reminderDate('2027-05-05'), '2027-04-30');
});

test('retries stay anchored to the original due date', () => {
  assert.equal(retryDate('2027-03-05', 2), '2027-03-08');
  assert.equal(retryDate('2027-03-05', 3), '2027-03-12');
  assert.equal(retryDate('2027-03-05', 4), null);
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});
