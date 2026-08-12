import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildClubSeasonPaymentTerms,
  hashClubSeasonPaymentTerms,
} from '../src/lib/club-season-payment.ts';

const pricing = {
  totalAmount: 150000,
  depositAmount: 40000,
  installmentAmount: 22000,
  installmentCount: 5,
};

test('pay in full produces one charge due at registration', () => {
  const terms = buildClubSeasonPaymentTerms({
    paymentOption: 'pay_in_full',
    registrationDate: '2026-11-12',
    firstInstallmentDate: '2027-01-05',
    billingDay: 5,
    pricing,
  });

  assert.equal(terms.dueNowAmount, 150000);
  assert.deepEqual(terms.charges, [{
    sequence: 0,
    type: 'full_payment',
    dueDate: '2026-11-12',
    amount: 150000,
  }]);
});

test('standard plan snapshots the deposit and January through May charges', () => {
  const terms = buildClubSeasonPaymentTerms({
    paymentOption: 'standard_plan',
    registrationDate: '2026-11-12',
    firstInstallmentDate: '2027-01-05',
    billingDay: 5,
    pricing,
  });

  assert.equal(terms.dueNowAmount, 40000);
  assert.deepEqual(terms.charges.map(({ dueDate, amount }) => ({ dueDate, amount })), [
    { dueDate: '2026-11-12', amount: 40000 },
    { dueDate: '2027-01-05', amount: 22000 },
    { dueDate: '2027-02-05', amount: 22000 },
    { dueDate: '2027-03-05', amount: 22000 },
    { dueDate: '2027-04-05', amount: 22000 },
    { dueDate: '2027-05-05', amount: 22000 },
  ]);
});

test('terms fingerprint changes when the selected option changes', async () => {
  const common = {
    registrationDate: '2026-11-12',
    firstInstallmentDate: '2027-01-05',
    billingDay: 5,
    pricing,
  };
  const full = await hashClubSeasonPaymentTerms(buildClubSeasonPaymentTerms({
    ...common,
    paymentOption: 'pay_in_full',
  }));
  const plan = await hashClubSeasonPaymentTerms(buildClubSeasonPaymentTerms({
    ...common,
    paymentOption: 'standard_plan',
  }));

  assert.match(full, /^[a-f0-9]{64}$/);
  assert.notEqual(full, plan);
});
