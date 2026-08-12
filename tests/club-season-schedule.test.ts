import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStandardClubSeasonSchedule } from '../src/lib/club-season-schedule.ts';

const standardSchedule = {
  registrationDate: '2026-11-15',
  firstInstallmentDate: '2027-01-05',
  billingDay: 5,
};

test('builds the confirmed 12U deposit and January-May schedule', () => {
  const schedule = buildStandardClubSeasonSchedule({
    ...standardSchedule,
    terms: {
      totalAmount: 120_000,
      depositAmount: 30_000,
      installmentAmount: 18_000,
      installmentCount: 5,
    },
  });

  assert.equal(schedule.totalAmount, 120_000);
  assert.equal(schedule.remainingAfterDeposit, 90_000);
  assert.deepEqual(schedule.charges, [
    { sequence: 0, type: 'deposit', dueDate: '2026-11-15', amount: 30_000 },
    { sequence: 1, type: 'installment', dueDate: '2027-01-05', amount: 18_000 },
    { sequence: 2, type: 'installment', dueDate: '2027-02-05', amount: 18_000 },
    { sequence: 3, type: 'installment', dueDate: '2027-03-05', amount: 18_000 },
    { sequence: 4, type: 'installment', dueDate: '2027-04-05', amount: 18_000 },
    { sequence: 5, type: 'installment', dueDate: '2027-05-05', amount: 18_000 },
  ]);
  assert.equal(schedule.charges.some((charge) => charge.dueDate.startsWith('2026-12')), false);
});

test('builds the confirmed 13U-18U pricing without changing dates', () => {
  const schedule = buildStandardClubSeasonSchedule({
    ...standardSchedule,
    terms: {
      totalAmount: 150_000,
      depositAmount: 40_000,
      installmentAmount: 22_000,
      installmentCount: 5,
    },
  });

  assert.equal(schedule.totalAmount, 150_000);
  assert.equal(schedule.depositAmount, 40_000);
  assert.equal(schedule.installmentTotal, 110_000);
  assert.deepEqual(
    schedule.charges.slice(1).map((charge) => charge.amount),
    [22_000, 22_000, 22_000, 22_000, 22_000]
  );
});
test('supports an individual billing-day override', () => {
  const schedule = buildStandardClubSeasonSchedule({
    ...standardSchedule,
    billingDay: 20,
    terms: {
      totalAmount: 120_000,
      depositAmount: 30_000,
      installmentAmount: 18_000,
      installmentCount: 5,
    },
  });

  assert.deepEqual(
    schedule.charges.slice(1).map((charge) => charge.dueDate),
    ['2027-01-20', '2027-02-20', '2027-03-20', '2027-04-20', '2027-05-20']
  );
});

test('uses the last calendar day when an override does not exist in a month', () => {
  const schedule = buildStandardClubSeasonSchedule({
    ...standardSchedule,
    billingDay: 31,
    terms: {
      totalAmount: 120_000,
      depositAmount: 30_000,
      installmentAmount: 18_000,
      installmentCount: 5,
    },
  });

  assert.deepEqual(
    schedule.charges.slice(1).map((charge) => charge.dueDate),
    ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31']
  );
});

test('rejects pricing terms whose deposit and installments do not reconcile', () => {
  assert.throws(
    () => buildStandardClubSeasonSchedule({
      ...standardSchedule,
      terms: {
        totalAmount: 150_000,
        depositAmount: 40_000,
        installmentAmount: 20_000,
        installmentCount: 5,
      },
    }),
    /do not reconcile/
  );
});

test('rejects a standard plan whose first installment is not after registration', () => {
  assert.throws(
    () => buildStandardClubSeasonSchedule({
      registrationDate: '2027-01-05',
      firstInstallmentDate: '2027-01-05',
      billingDay: 5,
      terms: {
        totalAmount: 120_000,
        depositAmount: 30_000,
        installmentAmount: 18_000,
        installmentCount: 5,
      },
    }),
    /must be due after/
  );
});
