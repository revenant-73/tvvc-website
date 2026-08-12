import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, installmentChargeAmount, reminderDate, retryDate } from '../src/lib/club-season-billing-dates.ts';
import { paymentFailedEmail } from '../src/lib/club-season-payment-emails.ts';

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

test('manual credits cap an automatic charge at the true remaining balance', () => {
  assert.equal(installmentChargeAmount(22000, 7000), 7000);
  assert.equal(installmentChargeAmount(22000, 0), 0);
  assert.equal(installmentChargeAmount(22000, 50000), 22000);
});

test('failed-payment email names the exact automatic retry date', () => {
  const message = paymentFailedEmail({
    parentName: 'Taylor Parent',
    playerName: 'Jordan Player',
    teamName: '14U Teal',
    amount: 22000,
    dueDate: '2027-03-05',
    remainingBalance: 66000,
    portalUrl: 'https://example.test/portal/dashboard',
    attemptNumber: 1,
    nextAttemptDate: '2027-03-08',
  }, false);

  assert.match(message.html, /automatically retry on March 8, 2027/);
  assert.match(message.html, /attempt 1 of 3/);
  assert.match(message.html, /player remains on the roster/i);
});
