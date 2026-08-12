import assert from 'node:assert/strict';
import test from 'node:test';
import { initialPaymentSucceededEmail } from '../src/lib/club-season-payment-emails.ts';

const base = {
  parentName: 'Pilot Parent',
  playerName: 'Pilot Player',
  teamName: '14U Pilot',
  amount: 40_000,
  dueDate: '2026-11-12',
  remainingBalance: 110_000,
  portalUrl: 'https://example.test/portal/dashboard',
  receiptUrl: 'https://pay.stripe.com/receipts/test',
};

test('initial standard-plan confirmation includes the deposit, receipt, and complete future schedule', () => {
  const email = initialPaymentSucceededEmail({
    ...base,
    paymentOption: 'standard_plan',
    futureCharges: [
      { dueDate: '2027-01-05', amount: 22_000 },
      { dueDate: '2027-02-05', amount: 22_000 },
      { dueDate: '2027-03-05', amount: 22_000 },
      { dueDate: '2027-04-05', amount: 22_000 },
      { dueDate: '2027-05-05', amount: 22_000 },
    ],
  });

  assert.match(email.subject, /registration confirmed/i);
  assert.match(email.html, /Deposit paid/);
  assert.match(email.html, /Deposit paid on/);
  assert.match(email.html, /\$400\.00/);
  assert.match(email.html, /\$1,100\.00/);
  assert.match(email.html, /Next automatic payment:<\/strong> \$220\.00 on January 5, 2027/);
  assert.match(email.html, /January 5, 2027/);
  assert.match(email.html, /May 5, 2027/);
  assert.match(email.html, /no December charge/i);
  assert.match(email.html, /View Stripe receipt/);
});

test('pay-in-full confirmation states that no future automatic charges remain', () => {
  const email = initialPaymentSucceededEmail({
    ...base,
    amount: 150_000,
    remainingBalance: 0,
    paymentOption: 'pay_in_full',
    futureCharges: [],
  });

  assert.match(email.html, /dues are paid in full/i);
  assert.match(email.html, /No future automatic club-season charges/i);
});
