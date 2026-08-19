import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index.ts';
import {
  clubSeasonAdminAuditLog,
  clubSeasonAgreementVersions,
  clubSeasonLaunchEvidence,
  clubSeasons,
  users,
} from '../db/schema.ts';
import {
  getClubSeasonLaunchReadiness,
  type ClubSeasonLaunchEnvironment,
  type ClubSeasonLaunchGate,
} from './club-season-launch-readiness.ts';

type Db = ReturnType<typeof getDb>;

export const CLUB_SEASON_AGREEMENT_TEMPLATES = {
  'season-commitment': {
    label: 'Season commitment',
    defaultTitle: 'Club season participation commitment',
    defaultSummary: 'Attendance, communication, and team participation',
    responseType: 'acknowledgement',
    allowedResponses: null,
    required: true,
    sortOrder: 10,
  },
  'refund-cancellation-policy': {
    label: 'Refund and cancellation policy',
    defaultTitle: 'Refund and cancellation policy',
    defaultSummary: 'How cancellations, withdrawals, and approved refunds are handled',
    responseType: 'acknowledgement',
    allowedResponses: null,
    required: true,
    sortOrder: 20,
  },
  'media-release': {
    label: 'Player media release',
    defaultTitle: 'Player media release',
    defaultSummary: 'Choose whether TVVC may use player photos or video',
    responseType: 'choice',
    allowedResponses: ['granted', 'declined'],
    required: true,
    sortOrder: 30,
  },
} as const;

export type ClubSeasonAgreementKey = keyof typeof CLUB_SEASON_AGREEMENT_TEMPLATES;
export type ClubSeasonRegistrationWindowState = 'not_configured' | 'not_open' | 'open' | 'closed';

export const CLUB_SEASON_LAUNCH_EVIDENCE = {
  resend_domain: { label: 'Resend domain verification', confirmation: 'RECORD RESEND' },
  stripe_live_review: { label: 'Stripe live-mode review', confirmation: 'RECORD STRIPE' },
  controlled_pilot: { label: 'Controlled pilot registration', confirmation: 'RECORD PILOT' },
} as const;

export const CLUB_SEASON_PILOT_CHECKS = [
  'registration',
  'payment',
  'email',
  'ledger',
  'failure_recovery',
  'idempotency',
] as const;

export type ClubSeasonLaunchEvidenceType = keyof typeof CLUB_SEASON_LAUNCH_EVIDENCE;

export function getClubSeasonRegistrationWindowState(
  season: { registrationOpensAt?: string | null; registrationClosesAt?: string | null },
  now = new Date()
): ClubSeasonRegistrationWindowState {
  if (!season.registrationOpensAt || !season.registrationClosesAt) return 'not_configured';
  const opensAt = Date.parse(season.registrationOpensAt);
  const closesAt = Date.parse(season.registrationClosesAt);
  if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt) || opensAt >= closesAt) return 'not_configured';
  const timestamp = now.getTime();
  if (timestamp < opensAt) return 'not_open';
  if (timestamp > closesAt) return 'closed';
  return 'open';
}

const agreementKeySchema = z.enum([
  'season-commitment',
  'refund-cancellation-policy',
  'media-release',
]);

const titleSchema = z.string().trim().min(3).max(160);
const summarySchema = z.string().trim().max(500).optional();
const bodySchema = z.string().trim().min(20).max(20_000);

export const updateRegistrationWindowSchema = z.object({
  action: z.literal('update_registration_window'),
  seasonId: z.string().trim().min(1).max(100),
  registrationOpensAt: z.string().datetime({ offset: true }),
  registrationClosesAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(5).max(500),
}).strict().refine(
  (value) => Date.parse(value.registrationOpensAt) < Date.parse(value.registrationClosesAt),
  { message: 'Registration must close after it opens.', path: ['registrationClosesAt'] }
);

export const setRegistrationAccessSchema = z.object({
  action: z.literal('set_registration_access'),
  seasonId: z.string().trim().min(1).max(100),
  enabled: z.boolean(),
  expectedEnabled: z.boolean(),
  confirmation: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(10).max(500),
}).strict().superRefine((value, context) => {
  const expected = value.enabled ? 'OPEN REGISTRATION' : 'CLOSE REGISTRATION';
  if (value.confirmation !== expected) {
    context.addIssue({
      code: 'custom',
      path: ['confirmation'],
      message: `Type ${expected} exactly.`,
    });
  }
  if (value.enabled === value.expectedEnabled) {
    context.addIssue({
      code: 'custom',
      path: ['expectedEnabled'],
      message: 'The requested state must differ from the current state.',
    });
  }
});

export class RegistrationOpenBlockedError extends Error {
  blockers: ClubSeasonLaunchGate[];

  constructor(blockers: ClubSeasonLaunchGate[]) {
    super('REGISTRATION_OPEN_BLOCKED');
    this.name = 'RegistrationOpenBlockedError';
    this.blockers = blockers;
  }
}

export const createAgreementDraftSchema = z.object({
  action: z.literal('create_agreement_draft'),
  seasonId: z.string().trim().min(1).max(100),
  key: agreementKeySchema,
  title: titleSchema,
  summary: summarySchema,
  body: bodySchema,
}).strict();

export const updateAgreementDraftSchema = z.object({
  action: z.literal('update_agreement_draft'),
  agreementId: z.string().trim().min(1).max(100),
  title: titleSchema,
  summary: summarySchema,
  body: bodySchema,
}).strict();

export const publishAgreementSchema = z.object({
  action: z.literal('publish_agreement'),
  agreementId: z.string().trim().min(1).max(100),
  confirmation: z.string().trim().min(1).max(40),
  approvalReference: z.string().trim().min(10).max(1000),
}).strict();

const launchEvidenceTypeSchema = z.enum([
  'resend_domain',
  'stripe_live_review',
  'controlled_pilot',
]);
const pilotCheckSchema = z.enum(CLUB_SEASON_PILOT_CHECKS);

export const recordLaunchEvidenceSchema = z.object({
  action: z.literal('record_launch_evidence'),
  seasonId: z.string().trim().min(1).max(100),
  type: launchEvidenceTypeSchema,
  confirmation: z.string().trim().min(1).max(40),
  evidenceReference: z.string().trim().min(10).max(2000),
  checks: z.array(pilotCheckSchema).max(CLUB_SEASON_PILOT_CHECKS.length).optional(),
}).strict().superRefine((value, context) => {
  if (value.confirmation !== CLUB_SEASON_LAUNCH_EVIDENCE[value.type].confirmation) {
    context.addIssue({ code: 'custom', path: ['confirmation'], message: 'Type the exact recording phrase shown.' });
  }
  if (value.type === 'controlled_pilot') {
    const checks = new Set(value.checks || []);
    if (checks.size !== CLUB_SEASON_PILOT_CHECKS.length) {
      context.addIssue({ code: 'custom', path: ['checks'], message: 'Complete all six pilot checks before recording evidence.' });
    }
  } else if (value.checks?.length) {
    context.addIssue({ code: 'custom', path: ['checks'], message: 'Checklist evidence is only valid for the controlled pilot.' });
  }
});

export async function hashClubSeasonAgreement(input: {
  key: string;
  version: number;
  title: string;
  body: string;
}) {
  const bytes = new TextEncoder().encode([
    input.key,
    String(input.version),
    input.title,
    input.body,
  ].join('\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getClubSeasonAgreementVersions(db: Db, seasonId: string) {
  return db.select().from(clubSeasonAgreementVersions)
    .where(eq(clubSeasonAgreementVersions.seasonId, seasonId))
    .orderBy(asc(clubSeasonAgreementVersions.sortOrder), desc(clubSeasonAgreementVersions.version));
}

export async function updateClubSeasonRegistrationWindow(db: Db, input: {
  seasonId: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  reason: string;
  adminUserId: string;
}) {
  const registrationOpensAt = new Date(input.registrationOpensAt).toISOString();
  const registrationClosesAt = new Date(input.registrationClosesAt).toISOString();
  if (registrationOpensAt >= registrationClosesAt) throw new Error('INVALID_REGISTRATION_WINDOW');
  const [season] = await db.select().from(clubSeasons)
    .where(eq(clubSeasons.id, input.seasonId)).limit(1);
  if (!season) throw new Error('SEASON_NOT_FOUND');
  const now = new Date().toISOString();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx.update(clubSeasons).set({
      registrationOpensAt,
      registrationClosesAt,
      updatedAt: now,
    }).where(eq(clubSeasons.id, season.id)).returning();
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(),
      adminUserId: input.adminUserId,
      action: 'registration_window_updated',
      entityType: 'club_season',
      entityId: season.id,
      reason: input.reason,
      beforeSnapshot: JSON.stringify({
        registrationOpensAt: season.registrationOpensAt,
        registrationClosesAt: season.registrationClosesAt,
      }),
      afterSnapshot: JSON.stringify({ registrationOpensAt, registrationClosesAt }),
      createdAt: now,
    });
    return rows;
  });
  return updated;
}

export async function setClubSeasonRegistrationAccess(db: Db, input: {
  seasonId: string;
  enabled: boolean;
  expectedEnabled: boolean;
  confirmation: string;
  reason: string;
  adminUserId: string;
  environment: ClubSeasonLaunchEnvironment;
}) {
  const expectedConfirmation = input.enabled ? 'OPEN REGISTRATION' : 'CLOSE REGISTRATION';
  if (input.confirmation !== expectedConfirmation) {
    throw new Error('REGISTRATION_ACCESS_CONFIRMATION_MISMATCH');
  }
  if (input.enabled === input.expectedEnabled) {
    throw new Error('REGISTRATION_ACCESS_INVALID_TRANSITION');
  }

  const [season] = await db.select().from(clubSeasons)
    .where(eq(clubSeasons.id, input.seasonId)).limit(1);
  if (!season) throw new Error('SEASON_NOT_FOUND');
  if (season.publicRegistrationEnabled !== input.expectedEnabled) {
    throw new Error('REGISTRATION_ACCESS_STATE_CHANGED');
  }

  let readiness = null;
  if (input.enabled) {
    readiness = await getClubSeasonLaunchReadiness(db, input.seasonId, input.environment);
    const blockers = readiness.gates.filter((gate) => (
      gate.key !== 'database_lock' && gate.status !== 'passed'
    ));
    if (!readiness.readyToOpenRegistration || blockers.length) {
      throw new RegistrationOpenBlockedError(blockers);
    }
  }

  const now = new Date().toISOString();
  const reason = input.reason.trim();
  const updated = await db.transaction(async (tx) => {
    const [changed] = await tx.update(clubSeasons).set({
      publicRegistrationEnabled: input.enabled,
      updatedAt: now,
    }).where(and(
      eq(clubSeasons.id, input.seasonId),
      eq(clubSeasons.publicRegistrationEnabled, input.expectedEnabled)
    )).returning();
    if (!changed) throw new Error('REGISTRATION_ACCESS_STATE_CHANGED');

    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(),
      adminUserId: input.adminUserId,
      action: input.enabled ? 'registration_access_opened' : 'registration_access_closed',
      entityType: 'club_season',
      entityId: input.seasonId,
      reason,
      beforeSnapshot: JSON.stringify({ publicRegistrationEnabled: input.expectedEnabled }),
      afterSnapshot: JSON.stringify({
        publicRegistrationEnabled: input.enabled,
        verifiedReadinessGates: input.enabled
          ? readiness?.gates
            .filter((gate) => gate.key !== 'database_lock' && gate.status === 'passed')
            .map((gate) => gate.key)
          : null,
      }),
      createdAt: now,
    });
    return changed;
  });

  return { season: updated, readiness };
}

export async function createClubSeasonAgreementDraft(db: Db, input: {
  seasonId: string;
  key: ClubSeasonAgreementKey;
  title: string;
  summary?: string;
  body: string;
  adminUserId: string;
}) {
  const template = CLUB_SEASON_AGREEMENT_TEMPLATES[input.key];
  if (!template) throw new Error('AGREEMENT_KEY_NOT_SUPPORTED');
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return db.transaction(async (tx) => {
    const [season] = await tx.select({ id: clubSeasons.id }).from(clubSeasons)
      .where(eq(clubSeasons.id, input.seasonId)).limit(1);
    if (!season) throw new Error('SEASON_NOT_FOUND');
    const [existingDraft] = await tx.select({ id: clubSeasonAgreementVersions.id })
      .from(clubSeasonAgreementVersions).where(and(
        eq(clubSeasonAgreementVersions.seasonId, input.seasonId),
        eq(clubSeasonAgreementVersions.key, input.key),
        eq(clubSeasonAgreementVersions.status, 'draft')
      )).limit(1);
    if (existingDraft) throw new Error('AGREEMENT_DRAFT_EXISTS');
    const [latest] = await tx.select({ version: sql<number>`max(${clubSeasonAgreementVersions.version})` })
      .from(clubSeasonAgreementVersions).where(and(
        eq(clubSeasonAgreementVersions.seasonId, input.seasonId),
        eq(clubSeasonAgreementVersions.key, input.key)
      ));
    const version = Number(latest?.version || 0) + 1;
    const contentHash = await hashClubSeasonAgreement({
      key: input.key,
      version,
      title: input.title,
      body: input.body,
    });
    const [agreement] = await tx.insert(clubSeasonAgreementVersions).values({
      id,
      seasonId: input.seasonId,
      key: input.key,
      version,
      title: input.title,
      summary: input.summary?.trim() || null,
      body: input.body,
      contentHash,
      responseType: template.responseType,
      allowedResponses: template.allowedResponses ? JSON.stringify(template.allowedResponses) : null,
      status: 'draft',
      required: template.required,
      sortOrder: template.sortOrder,
      createdByUserId: input.adminUserId,
      createdAt: now,
      updatedAt: now,
    }).returning();
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId,
      action: 'agreement_draft_created', entityType: 'agreement_version', entityId: id,
      reason: `Created ${template.label} version ${version} draft.`,
      beforeSnapshot: null,
      afterSnapshot: JSON.stringify({ key: input.key, version, contentHash }),
      createdAt: now,
    });
    return agreement;
  });
}

export async function updateClubSeasonAgreementDraft(db: Db, input: {
  agreementId: string;
  title: string;
  summary?: string;
  body: string;
  adminUserId: string;
}) {
  const [existing] = await db.select().from(clubSeasonAgreementVersions)
    .where(eq(clubSeasonAgreementVersions.id, input.agreementId)).limit(1);
  if (!existing || existing.status !== 'draft') throw new Error('AGREEMENT_DRAFT_NOT_FOUND');
  const contentHash = await hashClubSeasonAgreement({
    key: existing.key,
    version: existing.version,
    title: input.title,
    body: input.body,
  });
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(clubSeasonAgreementVersions).set({
      title: input.title,
      summary: input.summary?.trim() || null,
      body: input.body,
      contentHash,
      updatedAt: now,
    }).where(and(
      eq(clubSeasonAgreementVersions.id, existing.id),
      eq(clubSeasonAgreementVersions.status, 'draft')
    )).returning();
    if (!updated) throw new Error('AGREEMENT_DRAFT_NOT_FOUND');
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId,
      action: 'agreement_draft_updated', entityType: 'agreement_version', entityId: existing.id,
      reason: `Updated ${existing.key} version ${existing.version} draft.`,
      beforeSnapshot: JSON.stringify({
        title: existing.title, summary: existing.summary, body: existing.body,
        contentHash: existing.contentHash,
      }),
      afterSnapshot: JSON.stringify({
        title: updated.title, summary: updated.summary, body: updated.body,
        contentHash: updated.contentHash,
      }),
      createdAt: now,
    });
    return updated;
  });
}

export async function publishClubSeasonAgreement(db: Db, input: {
  agreementId: string;
  confirmation: string;
  approvalReference: string;
  adminUserId: string;
}) {
  const [draft] = await db.select().from(clubSeasonAgreementVersions)
    .where(eq(clubSeasonAgreementVersions.id, input.agreementId)).limit(1);
  if (!draft || draft.status !== 'draft') throw new Error('AGREEMENT_DRAFT_NOT_FOUND');
  if (input.confirmation !== `PUBLISH V${draft.version}`) throw new Error('PUBLISH_CONFIRMATION_MISMATCH');
  const expectedHash = await hashClubSeasonAgreement({
    key: draft.key, version: draft.version, title: draft.title, body: draft.body,
  });
  if (expectedHash !== draft.contentHash) throw new Error('AGREEMENT_CONTENT_HASH_MISMATCH');
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(clubSeasonAgreementVersions).where(and(
      eq(clubSeasonAgreementVersions.seasonId, draft.seasonId),
      eq(clubSeasonAgreementVersions.key, draft.key),
      eq(clubSeasonAgreementVersions.status, 'published')
    )).limit(1);
    if (current) {
      await tx.update(clubSeasonAgreementVersions).set({
        status: 'retired', retiredAt: now, updatedAt: now,
      }).where(and(
        eq(clubSeasonAgreementVersions.id, current.id),
        eq(clubSeasonAgreementVersions.status, 'published')
      ));
    }
    const [published] = await tx.update(clubSeasonAgreementVersions).set({
      status: 'published', publishedAt: now, effectiveAt: now, updatedAt: now,
    }).where(and(
      eq(clubSeasonAgreementVersions.id, draft.id),
      eq(clubSeasonAgreementVersions.status, 'draft')
    )).returning();
    if (!published) throw new Error('AGREEMENT_DRAFT_NOT_FOUND');
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(), adminUserId: input.adminUserId,
      action: 'agreement_published', entityType: 'agreement_version', entityId: draft.id,
      reason: input.approvalReference,
      beforeSnapshot: JSON.stringify({
        draft: { id: draft.id, key: draft.key, version: draft.version, contentHash: draft.contentHash },
        replacedVersionId: current?.id || null,
      }),
      afterSnapshot: JSON.stringify({
        status: 'published', publishedAt: now, retiredVersionId: current?.id || null,
      }),
      createdAt: now,
    });
    return published;
  });
}

export async function recordClubSeasonLaunchEvidence(db: Db, input: {
  seasonId: string;
  type: ClubSeasonLaunchEvidenceType;
  confirmation: string;
  evidenceReference: string;
  checks?: Array<(typeof CLUB_SEASON_PILOT_CHECKS)[number]>;
  adminUserId: string;
}) {
  const definition = CLUB_SEASON_LAUNCH_EVIDENCE[input.type];
  if (!definition || input.confirmation !== definition.confirmation) {
    throw new Error('LAUNCH_EVIDENCE_CONFIRMATION_MISMATCH');
  }
  const checks = new Set(input.checks || []);
  if (
    input.type === 'controlled_pilot' &&
    (checks.size !== CLUB_SEASON_PILOT_CHECKS.length ||
      CLUB_SEASON_PILOT_CHECKS.some((check) => !checks.has(check)))
  ) {
    throw new Error('PILOT_CHECKLIST_INCOMPLETE');
  }
  if (input.type !== 'controlled_pilot' && checks.size > 0) {
    throw new Error('PILOT_CHECKLIST_NOT_ALLOWED');
  }

  const [season] = await db.select({ id: clubSeasons.id }).from(clubSeasons)
    .where(eq(clubSeasons.id, input.seasonId)).limit(1);
  if (!season) throw new Error('SEASON_NOT_FOUND');
  const [existing] = await db.select({ id: clubSeasonLaunchEvidence.id })
    .from(clubSeasonLaunchEvidence).where(and(
      eq(clubSeasonLaunchEvidence.seasonId, input.seasonId),
      eq(clubSeasonLaunchEvidence.type, input.type)
    )).limit(1);
  if (existing) throw new Error('LAUNCH_EVIDENCE_ALREADY_RECORDED');

  const now = new Date().toISOString();
  const evidenceReference = input.evidenceReference.trim();
  if (evidenceReference.length < 10) throw new Error('LAUNCH_EVIDENCE_REFERENCE_REQUIRED');

  return db.transaction(async (tx) => {
    const [evidence] = await tx.insert(clubSeasonLaunchEvidence).values({
      id: crypto.randomUUID(),
      seasonId: input.seasonId,
      type: input.type,
      evidenceReference,
      checksSnapshot: input.type === 'controlled_pilot'
        ? JSON.stringify(CLUB_SEASON_PILOT_CHECKS)
        : null,
      recordedByUserId: input.adminUserId,
      recordedAt: now,
      createdAt: now,
    }).returning();
    await tx.insert(clubSeasonAdminAuditLog).values({
      id: crypto.randomUUID(),
      adminUserId: input.adminUserId,
      action: 'launch_evidence_recorded',
      entityType: 'club_season_launch_evidence',
      entityId: evidence.id,
      reason: evidenceReference,
      beforeSnapshot: null,
      afterSnapshot: JSON.stringify({ type: input.type, checks: [...checks] }),
      createdAt: now,
    });
    return evidence;
  });
}

export async function getClubSeasonLaunchEvidence(db: Db, seasonId: string) {
  const recorded = await db.select({
    type: clubSeasonLaunchEvidence.type,
    evidenceReference: clubSeasonLaunchEvidence.evidenceReference,
    recordedAt: clubSeasonLaunchEvidence.recordedAt,
    recordedByName: users.name,
    recordedByEmail: users.email,
  }).from(clubSeasonLaunchEvidence)
    .leftJoin(users, eq(users.id, clubSeasonLaunchEvidence.recordedByUserId))
    .where(eq(clubSeasonLaunchEvidence.seasonId, seasonId));
  const byType = new Map(recorded.map((item) => [item.type, item]));

  return (Object.keys(CLUB_SEASON_LAUNCH_EVIDENCE) as ClubSeasonLaunchEvidenceType[]).map((type) => {
    const item = byType.get(type);
    return {
      type,
      label: CLUB_SEASON_LAUNCH_EVIDENCE[type].label,
      completed: Boolean(item),
      completedAt: item?.recordedAt || null,
      completedByName: item?.recordedByName || null,
      completedByEmail: item?.recordedByEmail || null,
      evidenceReference: item?.evidenceReference || null,
    };
  });
}
