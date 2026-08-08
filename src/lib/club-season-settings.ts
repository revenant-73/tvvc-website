import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index.ts';
import {
  clubSeasonAdminAuditLog,
  clubSeasonAgreementVersions,
  clubSeasons,
} from '../db/schema.ts';

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
