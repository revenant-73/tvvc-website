import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import {
  clubAgeGroups,
  clubPricingTiers,
  clubSeasonAdminAuditLog,
  clubSeasonAgreementVersions,
  clubSeasonLaunchEvidence,
  clubSeasons,
  clubTeams,
} from '../db/schema.ts';

type Database = ReturnType<typeof getDb>;

export type LaunchGateStatus = 'passed' | 'blocked' | 'manual';

export type ClubSeasonLaunchGate = {
  key: string;
  label: string;
  detail: string;
  status: LaunchGateStatus;
  blocking: boolean;
};

export type ClubSeasonLaunchReadiness = {
  readyForPilot: boolean;
  readyForLive: boolean;
  summary: { passed: number; total: number; blocking: number };
  gates: ClubSeasonLaunchGate[];
  featureFlagEnabled: boolean;
  seasonRegistrationEnabled: boolean;
  activeTeamCount: number;
  publishedAgreementCount: number;
};

export type ClubSeasonLaunchEnvironment = {
  featureFlagEnabled: boolean;
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  resendApiKey: string;
  cronSecret: string;
  billingEmail: string;
};

type ReadinessData = {
  season: typeof clubSeasons.$inferSelect;
  pricingTiers: Array<typeof clubPricingTiers.$inferSelect>;
  ageGroups: Array<typeof clubAgeGroups.$inferSelect>;
  teams: Array<typeof clubTeams.$inferSelect>;
  agreements: Array<typeof clubSeasonAgreementVersions.$inferSelect>;
  approvedAgreementVersionIds?: string[];
  launchEvidenceTypes?: string[];
};

function gate(
  key: string,
  label: string,
  passed: boolean,
  passedDetail: string,
  blockedDetail: string,
  blocking = true
): ClubSeasonLaunchGate {
  return {
    key,
    label,
    detail: passed ? passedDetail : blockedDetail,
    status: passed ? 'passed' : 'blocked',
    blocking: !passed && blocking,
  };
}

function manualGate(
  key: string,
  label: string,
  confirmed: boolean,
  confirmedDetail: string,
  pendingDetail: string
): ClubSeasonLaunchGate {
  return {
    key,
    label,
    detail: confirmed ? confirmedDetail : pendingDetail,
    status: confirmed ? 'passed' : 'manual',
    blocking: !confirmed,
  };
}

function keyMode(secretKey: string, publishableKey: string) {
  if (secretKey.startsWith('sk_live_') && publishableKey.startsWith('pk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_') && publishableKey.startsWith('pk_test_')) return 'test';
  return 'invalid';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function evaluateClubSeasonLaunchReadiness(
  data: ReadinessData,
  environment: ClubSeasonLaunchEnvironment
): ClubSeasonLaunchReadiness {
  const activePricingTiers = data.pricingTiers.filter((item) => item.active);
  const activeAgeGroups = data.ageGroups.filter((item) => item.active);
  const activeTeams = data.teams.filter((item) => item.active);
  const activeTierIds = new Set(activePricingTiers.map((item) => item.id));
  const activeAgeGroupIds = new Set(
    activeAgeGroups
      .filter((item) => activeTierIds.has(item.pricingTierId))
      .map((item) => item.id)
  );
  const pricingReconciles = activePricingTiers.length > 0 && activePricingTiers.every(
    (item) => item.totalAmount === item.depositAmount + (
      data.season.standardInstallmentCount * item.installmentAmount
    )
  );
  const teamsAreValid = activeTeams.length > 0 && activeTeams.every(
    (item) => activeAgeGroupIds.has(item.ageGroupId)
  );
  const publishedKeys = new Set(data.agreements.map((item) => item.key));
  const requiredAgreementKeys = ['season-commitment', 'refund-cancellation-policy'];
  const requiredAgreementsPublished = requiredAgreementKeys.every((key) => publishedKeys.has(key));
  const approvedAgreementVersionIds = new Set(data.approvedAgreementVersionIds || []);
  const launchEvidenceTypes = new Set(data.launchEvidenceTypes || []);
  const requiredAgreementsApproved = requiredAgreementKeys.every((key) => {
    const agreement = data.agreements.find((item) => item.key === key);
    return Boolean(agreement && approvedAgreementVersionIds.has(agreement.id));
  });
  const stripeMode = keyMode(environment.stripeSecretKey, environment.stripePublishableKey);
  const stripeConfigured = stripeMode !== 'invalid' && environment.stripeWebhookSecret.startsWith('whsec_');
  const scheduleConfigured = data.season.defaultBillingDay === 5 &&
    data.season.standardInstallmentCount === 5 &&
    /^\d{4}-01-05$/.test(data.season.firstInstallmentDate);
  const registrationWindowConfigured = Boolean(
    data.season.registrationOpensAt && data.season.registrationClosesAt
  );

  const automatedGates: ClubSeasonLaunchGate[] = [
    gate(
      'season',
      'Active season record',
      data.season.status === 'active',
      `${data.season.name} is active.`,
      'Set the season status to active before a pilot.'
    ),
    gate(
      'schedule',
      'Standard billing schedule',
      scheduleConfigured,
      'Deposit in November; no December charge; five installments run January–May on the 5th.',
      'The season must use five January–May installments on the 5th, with December skipped.'
    ),
    gate(
      'pricing',
      'Pricing reconciliation',
      pricingReconciles,
      `${activePricingTiers.length} active pricing structure${activePricingTiers.length === 1 ? '' : 's'} reconcile exactly.`,
      'Every active price must equal its deposit plus all five installments.'
    ),
    gate(
      'teams',
      'Active team configuration',
      teamsAreValid,
      `${activeTeams.length} active team${activeTeams.length === 1 ? '' : 's'} link to active age groups and pricing.`,
      'Add at least one active team and resolve any inactive age-group or pricing links.'
    ),
    gate(
      'agreements',
      'Published required agreements',
      requiredAgreementsPublished,
      `Season commitment and refund/cancellation policy are published (${data.agreements.length} total versions visible to families).`,
      'Publish approved season-commitment and refund-cancellation-policy versions.'
    ),
    gate(
      'registration_window',
      'Registration window',
      registrationWindowConfigured,
      'Registration opening and closing timestamps are configured.',
      'Set the registration opening and closing timestamps before a pilot.'
    ),
    gate(
      'stripe',
      'Stripe and webhook configuration',
      stripeConfigured,
      `Matching Stripe ${stripeMode}-mode keys and a webhook signing secret are configured.`,
      'Configure matching Stripe test or live keys plus the webhook signing secret.'
    ),
    gate(
      'resend',
      'Transactional email configuration',
      environment.resendApiKey.startsWith('re_'),
      'A Resend API key is configured.',
      'Configure the Resend API key before sending registration or billing email.'
    ),
    gate(
      'billing_worker',
      'Billing worker protection',
      environment.cronSecret.trim().length >= 32 && isValidEmail(environment.billingEmail),
      'The scheduled billing worker has a strong secret and a valid escalation address.',
      'Set a 32+ character cron secret and a valid club billing email.'
    ),
  ];

  const pilotBlocking = automatedGates.some((item) => item.blocking);
  const manualGates = [
    manualGate(
      'agreement_approval',
      'Agreement and refund-policy approval',
      requiredAgreementsApproved,
      'Each required published version has a persistent administrator approval reference.',
      'Publish each approved required agreement through the publishing desk with its approval reference.'
    ),
    manualGate(
      'resend_domain',
      'Resend domain verification',
      launchEvidenceTypes.has('resend_domain'),
      'Production sending-domain verification is recorded.',
      'Verify the sending domain, then record the evidence in the launch verification console.'
    ),
    manualGate(
      'stripe_live_review',
      'Stripe live-mode review',
      launchEvidenceTypes.has('stripe_live_review') && stripeMode === 'live',
      'Live Stripe pricing, receipts, payment methods, and webhook delivery have been reviewed.',
      stripeMode === 'live'
        ? 'Complete the live Stripe review, then record the evidence in the launch verification console.'
        : 'The pilot may use test mode; production requires matching live keys and a completed Stripe review.'
    ),
    manualGate(
      'pilot',
      'Controlled pilot registration',
      launchEvidenceTypes.has('controlled_pilot'),
      'A controlled end-to-end pilot is recorded as complete.',
      'Complete all six pilot checks, then record the evidence in the launch verification console.'
    ),
  ];

  const launchLocks = [
    gate(
      'database_lock',
      'Database registration lock',
      data.season.publicRegistrationEnabled,
      'The season permits parent registration.',
      'The season-level registration switch is off.',
      false
    ),
    gate(
      'feature_flag_lock',
      'Netlify feature-flag lock',
      environment.featureFlagEnabled,
      'The deployment feature flag is on.',
      'CLUB_SEASON_REGISTRATION_ENABLED is false.',
      false
    ),
  ];

  const gates = [...automatedGates, ...manualGates, ...launchLocks];
  const manualBlocking = manualGates.some((item) => item.blocking);
  const readyForPilot = !pilotBlocking;
  const readyForLive = readyForPilot &&
    !manualBlocking &&
    stripeMode === 'live' &&
    data.season.publicRegistrationEnabled &&
    environment.featureFlagEnabled;

  return {
    readyForPilot,
    readyForLive,
    summary: {
      passed: gates.filter((item) => item.status === 'passed').length,
      total: gates.length,
      blocking: gates.filter((item) => item.blocking).length,
    },
    gates,
    featureFlagEnabled: environment.featureFlagEnabled,
    seasonRegistrationEnabled: data.season.publicRegistrationEnabled,
    activeTeamCount: activeTeams.length,
    publishedAgreementCount: data.agreements.length,
  };
}

export async function getClubSeasonLaunchReadiness(
  db: Database,
  seasonId: string,
  environment: ClubSeasonLaunchEnvironment
): Promise<ClubSeasonLaunchReadiness> {
  const [season] = await db.select().from(clubSeasons)
    .where(eq(clubSeasons.id, seasonId)).limit(1);
  if (!season) throw new Error('Club season not found.');

  const [pricingTiers, ageGroups, teams, agreements, launchEvidence] = await Promise.all([
    db.select().from(clubPricingTiers).where(eq(clubPricingTiers.seasonId, seasonId)),
    db.select().from(clubAgeGroups).where(eq(clubAgeGroups.seasonId, seasonId)),
    db.select().from(clubTeams).where(eq(clubTeams.seasonId, seasonId)),
    db.select().from(clubSeasonAgreementVersions).where(and(
      eq(clubSeasonAgreementVersions.seasonId, seasonId),
      eq(clubSeasonAgreementVersions.status, 'published')
    )),
    db.select({ type: clubSeasonLaunchEvidence.type }).from(clubSeasonLaunchEvidence)
      .where(eq(clubSeasonLaunchEvidence.seasonId, seasonId)),
  ]);

  const agreementIds = agreements.map((agreement) => agreement.id);
  const approvalAudits = agreementIds.length ? await db.select({
    entityId: clubSeasonAdminAuditLog.entityId,
  }).from(clubSeasonAdminAuditLog).where(and(
    eq(clubSeasonAdminAuditLog.action, 'agreement_published'),
    inArray(clubSeasonAdminAuditLog.entityId, agreementIds)
  )) : [];

  return evaluateClubSeasonLaunchReadiness({
    season,
    pricingTiers,
    ageGroups,
    teams,
    agreements,
    approvedAgreementVersionIds: approvalAudits.map((item) => item.entityId),
    launchEvidenceTypes: launchEvidence.map((item) => item.type),
  }, environment);
}
