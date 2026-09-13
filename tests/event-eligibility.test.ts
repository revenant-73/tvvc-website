import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getClubDate,
  getDefaultRegistrationClosesAtLocal,
  isRegistrationEventEligible,
} from '../src/lib/event-eligibility.ts';

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

test('respects event metadata registration open dates', () => {
  const dateLockedEvent = {
    active: true,
    startDate: '2027-01-11',
    endDate: '2027-03-12',
    metadata: JSON.stringify({ registrationOpensOn: '2026-10-01' }),
  };

  assert.equal(isRegistrationEventEligible(dateLockedEvent, '2026-09-30'), false);
  assert.equal(isRegistrationEventEligible(dateLockedEvent, '2026-10-01'), true);
});

test('respects event metadata registration close times', () => {
  const closingEvent = {
    active: true,
    startDate: '2026-09-13',
    endDate: '2026-09-13',
    metadata: JSON.stringify({ registrationClosesAtLocal: '2026-09-12T21:00' }),
  };

  assert.equal(
    isRegistrationEventEligible(closingEvent, { clubDateTime: '2026-09-12T20:59' }),
    true
  );
  assert.equal(
    isRegistrationEventEligible(closingEvent, { clubDateTime: '2026-09-12T21:00' }),
    false
  );
});

test('calculates the default 9pm night-before close time', () => {
  assert.equal(getDefaultRegistrationClosesAtLocal('2026-09-13'), '2026-09-12T21:00');
  assert.equal(getDefaultRegistrationClosesAtLocal('not-a-date'), null);
});

test('rejects events with malformed registration open dates', () => {
  assert.equal(isRegistrationEventEligible({
    active: true,
    startDate: '2027-01-11',
    endDate: '2027-03-12',
    metadata: JSON.stringify({ registrationOpensOn: 'October 1, 2026' }),
  }, '2026-10-01'), false);

  assert.equal(isRegistrationEventEligible({
    active: true,
    startDate: '2027-01-11',
    endDate: '2027-03-12',
    metadata: '{registrationOpensOn:2026-10-01}',
  }, '2026-10-01'), false);
});

test('rejects events with malformed registration close times', () => {
  assert.equal(isRegistrationEventEligible({
    active: true,
    startDate: '2026-09-13',
    endDate: '2026-09-13',
    metadata: JSON.stringify({ registrationClosesAtLocal: 'September 12, 2026 9pm' }),
  }, { clubDateTime: '2026-09-12T20:30' }), false);
});
