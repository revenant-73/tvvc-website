import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateClubSeasonLaunchReadiness } from '../src/lib/club-season-launch-readiness.ts';

const baseData = {
  season: {
    id: '2026-2027-club',
    name: '2026–2027 Club Season',
    status: 'active',
    timezone: 'America/Los_Angeles',
    defaultBillingDay: 5,
    firstInstallmentDate: '2027-01-05',
    standardInstallmentCount: 5,
    registrationOpensAt: '2026-11-01T08:00:00-08:00',
    registrationClosesAt: '2026-12-01T23:59:59-08:00',
    seasonStartDate: '2026-12-01',
    seasonEndDate: '2027-05-31',
    publicRegistrationEnabled: false,
  },
  pricingTiers: [
    { id: 'tier-12u', seasonId: '2026-2027-club', totalAmount: 120000, depositAmount: 30000, installmentAmount: 18000, active: true },
    { id: 'tier-13u-18u', seasonId: '2026-2027-club', totalAmount: 150000, depositAmount: 40000, installmentAmount: 22000, active: true },
  ],
  ageGroups: [
    { id: 'age-12u', seasonId: '2026-2027-club', pricingTierId: 'tier-12u', active: true },
    { id: 'age-14u', seasonId: '2026-2027-club', pricingTierId: 'tier-13u-18u', active: true },
  ],
  teams: [
    { id: 'team-12-black', seasonId: '2026-2027-club', ageGroupId: 'age-12u', active: true },
    { id: 'team-14-black', seasonId: '2026-2027-club', ageGroupId: 'age-14u', active: true },
  ],
  agreements: [
    { id: 'agreement-commitment', key: 'season-commitment', status: 'published' },
    { id: 'agreement-refund', key: 'refund-cancellation-policy', status: 'published' },
  ],
  approvedAgreementVersionIds: [],
  launchEvidenceTypes: [],
} as any;

const testEnvironment = {
  featureFlagEnabled: false,
  stripeSecretKey: 'sk_test_example',
  stripePublishableKey: 'pk_test_example',
  stripeWebhookSecret: 'whsec_example',
  resendApiKey: 're_example',
  cronSecret: 'a'.repeat(32),
  billingEmail: 'billing@tualatinvalleyvb.com',
};

test('a complete dark test-mode setup is ready for a controlled pilot, not live launch', () => {
  const readiness = evaluateClubSeasonLaunchReadiness(baseData, testEnvironment);

  assert.equal(readiness.readyForPilot, true);
  assert.equal(readiness.readyToOpenRegistration, false);
  assert.equal(readiness.readyForLive, false);
  assert.equal(readiness.activeTeamCount, 2);
  assert.equal(readiness.publishedAgreementCount, 2);
  assert.equal(readiness.gates.find((item) => item.key === 'database_lock')?.blocking, false);
  assert.equal(readiness.gates.find((item) => item.key === 'feature_flag_lock')?.blocking, false);
  assert.equal(readiness.gates.find((item) => item.key === 'agreement_approval')?.status, 'manual');
});

test('pricing, agreements, registration window, and mismatched Stripe keys block a pilot', () => {
  const readiness = evaluateClubSeasonLaunchReadiness({
    ...baseData,
    season: { ...baseData.season, registrationClosesAt: null },
    pricingTiers: [{ ...baseData.pricingTiers[0], totalAmount: 119999 }],
    agreements: [{ key: 'season-commitment', status: 'published' }],
  }, {
    ...testEnvironment,
    stripePublishableKey: 'pk_live_wrong_mode',
  });

  assert.equal(readiness.readyForPilot, false);
  assert.deepEqual(
    readiness.gates.filter((item) => item.blocking).map((item) => item.key),
    ['pricing', 'teams', 'agreements', 'registration_window', 'stripe', 'agreement_approval', 'resend_domain', 'stripe_live_review', 'pilot']
  );
});

test('live readiness requires both launch locks and all manual confirmations', () => {
  const readiness = evaluateClubSeasonLaunchReadiness({
    ...baseData,
    season: { ...baseData.season, publicRegistrationEnabled: true },
    approvedAgreementVersionIds: ['agreement-commitment', 'agreement-refund'],
    launchEvidenceTypes: ['resend_domain', 'stripe_live_review', 'controlled_pilot'],
  }, {
    ...testEnvironment,
    featureFlagEnabled: true,
    stripeSecretKey: 'sk_live_example',
    stripePublishableKey: 'pk_live_example',
  });

  assert.equal(readiness.readyForPilot, true);
  assert.equal(readiness.readyToOpenRegistration, true);
  assert.equal(readiness.readyForLive, true);
  assert.equal(readiness.summary.blocking, 0);
});

test('a closed database lock can be cleared for opening without pretending registration is already live', () => {
  const readiness = evaluateClubSeasonLaunchReadiness({
    ...baseData,
    approvedAgreementVersionIds: ['agreement-commitment', 'agreement-refund'],
    launchEvidenceTypes: ['resend_domain', 'stripe_live_review', 'controlled_pilot'],
  }, {
    ...testEnvironment,
    featureFlagEnabled: true,
    stripeSecretKey: 'sk_live_example',
    stripePublishableKey: 'pk_live_example',
  });

  assert.equal(readiness.seasonRegistrationEnabled, false);
  assert.equal(readiness.readyToOpenRegistration, true);
  assert.equal(readiness.readyForLive, false);
});
