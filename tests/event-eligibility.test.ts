import assert from 'node:assert/strict';
import test from 'node:test';
import { getClubDate, isRegistrationEventEligible } from '../src/lib/event-eligibility.ts';

test('calculates registration dates in the club timezone', () => {
  assert.equal(getClubDate(new Date('2026-07-31T07:30:00Z')), '2026-07-31');
});

test('allows active future and ongoing events through their final day', () => {
  assert.equal(isRegistrationEventEligible({
    active: true,
    startDate: '2026-08-10',
    endDate: '2026-08-12',
  }, '2026-07-31'), true);

  assert.equal(isRegistrationEventEligible({
    active: true,
    startDate: '2026-07-29',
    endDate: '2026-07-31',
  }, '2026-07-31'), true);
});

test('rejects inactive, expired, and malformed dated events', () => {
  assert.equal(isRegistrationEventEligible({
    active: false,
    startDate: '2099-08-10',
    endDate: '2099-08-10',
  }, '2026-07-31'), false);

  assert.equal(isRegistrationEventEligible({
    active: true,
    startDate: '2026-07-18',
    endDate: '2026-07-18',
  }, '2026-07-31'), false);

  assert.equal(isRegistrationEventEligible({
    active: true,
    startDate: 'July 18, 2026',
    endDate: null,
  }, '2026-07-31'), false);
});

test('keeps undated active events under explicit admin control', () => {
  assert.equal(isRegistrationEventEligible({
    active: true,
    startDate: null,
    endDate: null,
  }, '2026-07-31'), true);
});
