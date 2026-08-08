import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessClubSeasonRegistration,
  isClubSeasonPilotAccess,
  isClubSeasonRegistrationEnabled,
  isClubSeasonRouteAvailable,
} from '../src/lib/club-season-feature.ts';

const managedVariables = [
  'CLUB_SEASON_REGISTRATION_ENABLED',
  'CLUB_SEASON_PILOT_MODE',
  'CLUB_SEASON_PILOT_EMAILS',
  'STRIPE_SECRET_KEY',
] as const;

test('controlled pilot access is exact, test-mode-only, and independent of public locks', () => {
  const original = Object.fromEntries(managedVariables.map((name) => [name, process.env[name]]));
  try {
    process.env.CLUB_SEASON_REGISTRATION_ENABLED = 'false';
    process.env.CLUB_SEASON_PILOT_MODE = 'true';
    process.env.CLUB_SEASON_PILOT_EMAILS = ' Pilot.Parent@Example.com, second@example.com ';
    process.env.STRIPE_SECRET_KEY = 'sk_test_pilot_only';

    assert.equal(isClubSeasonRegistrationEnabled(), false);
    assert.equal(isClubSeasonPilotAccess('pilot.parent@example.com'), true);
    assert.equal(isClubSeasonPilotAccess('PILOT.PARENT@EXAMPLE.COM'), true);
    assert.equal(isClubSeasonPilotAccess('not-pilot@example.com'), false);
    assert.equal(isClubSeasonRouteAvailable('pilot.parent@example.com'), true);
    assert.equal(isClubSeasonRouteAvailable('not-pilot@example.com'), false);
    assert.equal(canAccessClubSeasonRegistration('pilot.parent@example.com', false), true);
    assert.equal(canAccessClubSeasonRegistration('pilot.parent@example.com', true), false);
    assert.equal(canAccessClubSeasonRegistration('not-pilot@example.com', false), false);

    process.env.STRIPE_SECRET_KEY = 'sk_live_never_allow_pilot';
    assert.equal(isClubSeasonPilotAccess('pilot.parent@example.com'), false);
    assert.equal(canAccessClubSeasonRegistration('pilot.parent@example.com', false), false);

    process.env.STRIPE_SECRET_KEY = 'sk_test_pilot_only';
    process.env.CLUB_SEASON_PILOT_MODE = 'false';
    assert.equal(isClubSeasonPilotAccess('pilot.parent@example.com'), false);

    process.env.CLUB_SEASON_REGISTRATION_ENABLED = 'true';
    assert.equal(isClubSeasonPilotAccess('pilot.parent@example.com'), false);
    assert.equal(canAccessClubSeasonRegistration('ordinary@example.com', true), true);
    assert.equal(canAccessClubSeasonRegistration('ordinary@example.com', false), false);
  } finally {
    for (const name of managedVariables) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
