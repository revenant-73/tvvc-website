import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  athletes,
  clubAgeGroups,
  clubPricingTiers,
  clubSeasonAdminAuditLog,
  clubSeasonInvitationBatchItems,
  clubSeasonInvitationBatches,
  clubSeasonInvitationDeliveryAttempts,
  clubSeasonOffers,
  clubSeasons,
  clubTeams,
  registrations,
  users,
} from '../db/schema.ts';
import { isClubSeasonRegistrationEnabled } from './club-season-feature.ts';
import { renderClubSeasonInvitationEmail } from './club-season-invitation-email.ts';
import { buildStandardClubSeasonSchedule } from './club-season-schedule.ts';
import { sendEmail } from './email.ts';

export const invitationActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), offerId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('test_send'), offerId: z.string().uuid(), recipient: z.string().email(), confirmation: z.literal('SEND TEST'), reason: z.string().trim().min(10).max(500), requestIdempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal('release'), seasonId: z.string().trim().min(1).max(100), teamId: z.string().trim().min(1).max(100), wave: z.enum(['nov8', 'nov15']), offerIds: z.array(z.string().uuid()).min(1).max(50), confirmation: z.literal('RELEASE INVITATIONS'), reason: z.string().trim().min(10).max(500), requestIdempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal('send_batch'), batchId: z.string().uuid(), confirmation: z.literal('SEND INVITATIONS') }).strict(),
  z.object({ action: z.literal('retry_failed'), batchId: z.string().uuid(), confirmation: z.literal('RETRY FAILED') }).strict(),
  z.object({ action: z.literal('resend_sent'), batchId: z.string().uuid(), itemIds: z.array(z.string().uuid()).min(1).max(50), confirmation: z.literal('RESEND SENT INVITATIONS'), reason: z.string().trim().min(10).max(500) }).strict(),
  z.object({ action: z.literal('history'), seasonId: z.string().trim().min(1).max(100), wave: z.enum(['nov8', 'nov15']) }).strict(),
]);

type Database = any;
type Admin = { id: string; email: string };
type EmailSender = typeof sendEmail;

function normalizeEmail(value: string | null | undefined) { return value?.trim().toLowerCase() || ''; }
export function isApprovedInvitationTestRecipient(recipient: string, adminEmail: string, billingEmail?: string | null) {
  const normalized = normalizeEmail(recipient);
  return Boolean(normalized) && [normalizeEmail(adminEmail), normalizeEmail(billingEmail)].filter(Boolean).includes(normalized);
}
function fingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Provider rejected the message.';
  return /rate|timeout|unavailable/i.test(message) ? 'Email provider temporarily unavailable.' : 'Email provider did not accept this message.';
}

type AttemptLike = { status: string; attemptNumber: number; attemptedAt?: string | null };
export function latestInvitationAttempt<T extends AttemptLike>(attempts: T[]): T | null {
  return [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber || String(b.attemptedAt || '').localeCompare(String(a.attemptedAt || '')))[0] || null;
}

export function summarizeInvitationItems(items: Array<{ attempts?: AttemptLike[] }>) {
  const latest = items.map((item) => latestInvitationAttempt(item.attempts || []));
  return {
    total: items.length,
    unsent: latest.filter((attempt) => !attempt).length,
    pending: latest.filter((attempt) => attempt?.status === 'pending').length,
    sent: latest.filter((attempt) => attempt?.status === 'sent').length,
    failed: latest.filter((attempt) => attempt?.status === 'failed').length,
  };
}

async function assertInvitationAccessOpen(db: Database, seasonId: string) {
  const [season] = await db.select({ publicRegistrationEnabled: clubSeasons.publicRegistrationEnabled }).from(clubSeasons).where(eq(clubSeasons.id, seasonId)).limit(1);
  if (!season?.publicRegistrationEnabled || !isClubSeasonRegistrationEnabled()) {
    throw Object.assign(new Error('Invitation activity is paused because both registration access locks are not open.'), { status: 409 });
  }
}

function requireAcceptedProviderResult(result: any) {
  if (result?.id) return result.id as string;
  if (process.env.PLAYWRIGHT_TEST === '1') return 'playwright-email-disabled';
  throw new Error('Email provider returned no accepted message identifier.');
}

function scheduleDates(firstInstallmentDate: string, billingDay: number, count: number): string[] {
  const [year, month] = firstInstallmentDate.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(billingDay, last)).padStart(2, '0')}`;
  });
}

async function loadSnapshots(db: Database, offerIds: string[]) {
  return db.select({
    offer: clubSeasonOffers,
    season: clubSeasons,
    team: clubTeams,
    ageGroup: clubAgeGroups,
    pricing: clubPricingTiers,
    playerFirstName: athletes.firstName,
    playerLastName: athletes.lastName,
    parentName: registrations.parentName,
    parentEmail: registrations.parentEmail,
    registrationUserId: registrations.userId,
    athleteParentId: athletes.parentId,
    ownerEmail: users.email,
  }).from(clubSeasonOffers)
    .innerJoin(clubSeasons, eq(clubSeasonOffers.seasonId, clubSeasons.id))
    .innerJoin(clubTeams, eq(clubSeasonOffers.teamId, clubTeams.id))
    .innerJoin(clubAgeGroups, eq(clubTeams.ageGroupId, clubAgeGroups.id))
    .innerJoin(clubPricingTiers, eq(clubAgeGroups.pricingTierId, clubPricingTiers.id))
    .innerJoin(registrations, eq(clubSeasonOffers.sourceRegistrationId, registrations.id))
    .innerJoin(athletes, and(eq(clubSeasonOffers.sourceAthleteId, athletes.id), eq(athletes.registrationId, registrations.id)))
    .leftJoin(users, eq(registrations.userId, users.id))
    .where(inArray(clubSeasonOffers.id, offerIds));
}

function deriveWave(ageCode: string): 'nov8' | 'nov15' {
  const age = Number(ageCode.replace(/\D/g, ''));
  return age <= 14 ? 'nov8' : 'nov15';
}

function validateSnapshot(row: any, expected: { seasonId?: string; wave?: string; status?: string }) {
  const problems: string[] = [];
  if (expected.seasonId && row.offer.seasonId !== expected.seasonId) problems.push('Offer belongs to another season.');
  if (expected.wave && deriveWave(row.ageGroup.code) !== expected.wave) problems.push('Offer belongs to another tryout wave.');
  if (expected.status && row.offer.status !== expected.status) problems.push(`Offer is ${row.offer.status}, not ${expected.status}.`);
  const recipient = normalizeEmail(row.offer.recipientEmail);
  const registered = normalizeEmail(row.parentEmail);
  const owner = normalizeEmail(row.ownerEmail);
  if (!recipient || recipient !== registered) problems.push('Recipient no longer matches the verified tryout registration.');
  if (!row.registrationUserId || row.athleteParentId !== row.registrationUserId || owner !== recipient) problems.push('Verified ownership chain does not match.');
  if (!row.team.active || !row.ageGroup.active) problems.push('Assigned team or age group is inactive.');
  if (!row.pricing.active || row.pricing.seasonId !== row.offer.seasonId) problems.push('Pricing tier is inactive or belongs to another season.');
  if (!row.offer.acceptanceDeadline) problems.push('Acceptance deadline is missing.');
  else if (row.offer.acceptanceDeadline < new Date().toISOString().slice(0, 10)) problems.push('Acceptance deadline has expired.');
  try {
    buildStandardClubSeasonSchedule({
      registrationDate: new Date().toISOString().slice(0, 10),
      firstInstallmentDate: row.season.firstInstallmentDate,
      billingDay: row.team.billingDayOverride || row.season.defaultBillingDay,
      terms: { totalAmount: row.pricing.totalAmount, depositAmount: row.pricing.depositAmount, installmentAmount: row.pricing.installmentAmount, installmentCount: row.season.standardInstallmentCount },
    });
  } catch { problems.push('Pricing and standard payment schedule do not reconcile.'); }
  return problems;
}

function emailModel(row: any, siteOrigin?: string) {
  const count = row.season.standardInstallmentCount;
  const billingDay = row.team.billingDayOverride || row.season.defaultBillingDay;
  return {
    parentName: row.parentName,
    playerName: `${row.playerFirstName} ${row.playerLastName}`,
    teamName: row.team.name,
    acceptanceDeadline: row.offer.acceptanceDeadline,
    totalAmount: row.pricing.totalAmount,
    depositAmount: row.pricing.depositAmount,
    installmentAmount: row.pricing.installmentAmount,
    installmentCount: count,
    installmentDates: scheduleDates(row.season.firstInstallmentDate, billingDay, count),
    siteOrigin,
  };
}

function itemValues(batchId: string, row: any) {
  const model = emailModel(row);
  return {
    id: crypto.randomUUID(), batchId, offerId: row.offer.id,
    recipientEmail: normalizeEmail(row.offer.recipientEmail), parentName: row.parentName,
    playerName: model.playerName, teamName: model.teamName,
    acceptanceDeadline: model.acceptanceDeadline, totalAmount: model.totalAmount,
    depositAmount: model.depositAmount, installmentAmount: model.installmentAmount,
    installmentCount: model.installmentCount, scheduleSnapshot: JSON.stringify(model.installmentDates),
    createdAt: new Date().toISOString(),
  };
}

export async function previewInvitation(db: Database, offerId: string, siteOrigin?: string) {
  const rows = await loadSnapshots(db, [offerId]);
  const row = rows[0];
  if (!row || !['ready', 'offered'].includes(row.offer.status)) throw Object.assign(new Error('Invitation not found.'), { status: 404 });
  return renderClubSeasonInvitationEmail(emailModel(row, siteOrigin));
}

export async function testSendInvitation(db: Database, admin: Admin, input: Extract<z.infer<typeof invitationActionSchema>, { action: 'test_send' }> & { siteOrigin?: string }, sender: EmailSender = sendEmail) {
  const recipient = normalizeEmail(input.recipient);
  const billingEmail = normalizeEmail(process.env.CLUB_SEASON_BILLING_EMAIL || 'loren@tualatinvalleyvb.com');
  if (!isApprovedInvitationTestRecipient(recipient, admin.email, billingEmail)) throw Object.assign(new Error('Test messages may be sent only to an approved administrator address.'), { status: 403 });
  const rendered = await previewInvitation(db, input.offerId, input.siteOrigin);
  const rows = await loadSnapshots(db, [input.offerId]);
  const row = rows[0];
  const existing = await db.select().from(clubSeasonInvitationBatches).where(eq(clubSeasonInvitationBatches.requestIdempotencyKey, input.requestIdempotencyKey)).limit(1);
  if (existing[0]) return { batch: existing[0], repeated: true };
  const batchId = crypto.randomUUID(); const now = new Date().toISOString();
  await db.insert(clubSeasonInvitationBatches).values({ id: batchId, seasonId: row.offer.seasonId, teamId: row.team.id, wave: deriveWave(row.ageGroup.code), kind: 'test', status: 'sending', subject: rendered.subject, templateFingerprint: rendered.templateFingerprint, requestIdempotencyKey: input.requestIdempotencyKey, requestFingerprint: fingerprint({ offerId: input.offerId, recipient }), adminUserId: admin.id, auditReason: input.reason, createdAt: now });
  const attemptId = crypto.randomUUID();
  await db.insert(clubSeasonInvitationDeliveryAttempts).values({ id: attemptId, batchId, batchItemId: null, attemptNumber: 1, recipientEmail: recipient, idempotencyKey: `club-test-${batchId}`, status: 'pending', adminUserId: admin.id, attemptedAt: now, createdAt: now });
  try {
    const result: any = await sender({ to: recipient, subject: `[TEST] ${rendered.subject}`, html: rendered.html, idempotencyKey: `club-test-${batchId}` });
    const providerMessageId = requireAcceptedProviderResult(result);
    await db.update(clubSeasonInvitationDeliveryAttempts).set({ status: 'sent', providerMessageId, resolvedAt: new Date().toISOString() }).where(eq(clubSeasonInvitationDeliveryAttempts.id, attemptId));
    await db.update(clubSeasonInvitationBatches).set({ status: 'completed', completedAt: new Date().toISOString() }).where(eq(clubSeasonInvitationBatches.id, batchId));
    await db.insert(clubSeasonAdminAuditLog).values({ id: crypto.randomUUID(), adminUserId: admin.id, action: 'invitation_test_sent', entityType: 'club_season_invitation_batch', entityId: batchId, reason: input.reason, beforeSnapshot: null, afterSnapshot: JSON.stringify({ recipient, status: 'sent', providerMessageId }), createdAt: new Date().toISOString() });
    return { batchId, status: 'sent' };
  } catch (error) {
    const errorMessage = safeError(error);
    await db.update(clubSeasonInvitationDeliveryAttempts).set({ status: 'failed', errorMessage: safeError(error), resolvedAt: new Date().toISOString() }).where(eq(clubSeasonInvitationDeliveryAttempts.id, attemptId));
    await db.update(clubSeasonInvitationBatches).set({ status: 'failed', completedAt: new Date().toISOString() }).where(eq(clubSeasonInvitationBatches.id, batchId));
    await db.insert(clubSeasonAdminAuditLog).values({ id: crypto.randomUUID(), adminUserId: admin.id, action: 'invitation_test_failed', entityType: 'club_season_invitation_batch', entityId: batchId, reason: input.reason, beforeSnapshot: null, afterSnapshot: JSON.stringify({ recipient, status: 'failed', errorMessage }), createdAt: new Date().toISOString() });
    return { batchId, status: 'failed' };
  }
}

export async function releaseInvitations(db: Database, admin: Admin, input: Extract<z.infer<typeof invitationActionSchema>, { action: 'release' }> & { siteOrigin?: string }) {
  if (new Set(input.offerIds).size !== input.offerIds.length) throw Object.assign(new Error('Offer IDs must be unique within a release.'), { status: 400 });
  const offerIds = [...input.offerIds].sort();
  const requestFingerprint = fingerprint({ seasonId: input.seasonId, teamId: input.teamId, wave: input.wave, offerIds, reason: input.reason });
  const [existing] = await db.select().from(clubSeasonInvitationBatches).where(eq(clubSeasonInvitationBatches.requestIdempotencyKey, input.requestIdempotencyKey)).limit(1);
  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) throw Object.assign(new Error('This request key was already used for a different release.'), { status: 409 });
    return { batch: existing, repeated: true };
  }
  const rows = await loadSnapshots(db, offerIds);
  if (rows.length !== offerIds.length) throw Object.assign(new Error('One or more offers could not be validated.'), { status: 409 });
  await assertInvitationAccessOpen(db, input.seasonId);
  const invalid = rows.flatMap((row: any) => validateSnapshot(row, { seasonId: input.seasonId, wave: input.wave, status: 'ready' }).map((problem) => `${row.playerFirstName} ${row.playerLastName}: ${problem}`));
  if (rows.some((row: any) => row.team.id !== input.teamId)) invalid.push('Every offer in a release must belong to the selected team.');
  if (invalid.length) throw Object.assign(new Error(invalid.join(' ')), { status: 409 });
  const rendered = renderClubSeasonInvitationEmail(emailModel(rows[0], input.siteOrigin));
  const batchId = crypto.randomUUID(); const now = new Date().toISOString();
  return db.transaction(async (tx: Database) => {
    await assertInvitationAccessOpen(tx, input.seasonId);
    await tx.insert(clubSeasonInvitationBatches).values({ id: batchId, seasonId: input.seasonId, teamId: input.teamId, wave: input.wave, kind: 'release', status: 'released', subject: rendered.subject, templateFingerprint: rendered.templateFingerprint, requestIdempotencyKey: input.requestIdempotencyKey, requestFingerprint, adminUserId: admin.id, auditReason: input.reason, createdAt: now, releasedAt: now });
    for (const row of rows) {
      await tx.insert(clubSeasonInvitationBatchItems).values(itemValues(batchId, row));
      const updated = await tx.update(clubSeasonOffers).set({ status: 'offered', offeredAt: now, updatedAt: now }).where(and(eq(clubSeasonOffers.id, row.offer.id), eq(clubSeasonOffers.status, 'ready'))).returning({ id: clubSeasonOffers.id });
      if (!updated[0]) throw Object.assign(new Error('An offer changed while the release was being completed.'), { status: 409 });
      await tx.insert(clubSeasonAdminAuditLog).values({ id: crypto.randomUUID(), adminUserId: admin.id, action: 'offer_released', entityType: 'club_season_offer', entityId: row.offer.id, reason: input.reason, beforeSnapshot: JSON.stringify(row.offer), afterSnapshot: JSON.stringify({ ...row.offer, status: 'offered', offeredAt: now }), createdAt: now });
    }
    await tx.insert(clubSeasonAdminAuditLog).values({ id: crypto.randomUUID(), adminUserId: admin.id, action: 'invitation_batch_released', entityType: 'club_season_invitation_batch', entityId: batchId, reason: input.reason, beforeSnapshot: null, afterSnapshot: JSON.stringify({ seasonId: input.seasonId, teamId: input.teamId, wave: input.wave, offerIds }), createdAt: now });
    return { batchId, released: rows.length, repeated: false };
  });
}

async function sendItems(db: Database, admin: Admin, batchId: string, mode: 'initial' | 'retry' | 'resend', selectedIds: string[] | undefined, sender: EmailSender) {
  const [batch] = await db.select().from(clubSeasonInvitationBatches).where(and(eq(clubSeasonInvitationBatches.id, batchId), eq(clubSeasonInvitationBatches.kind, 'release'))).limit(1);
  if (!batch) throw Object.assign(new Error('Invitation batch not found.'), { status: 404 });
  await assertInvitationAccessOpen(db, batch.seasonId);
  const allItems = await db.select().from(clubSeasonInvitationBatchItems).where(eq(clubSeasonInvitationBatchItems.batchId, batchId));
  let items = allItems;
  if (selectedIds) {
    if (new Set(selectedIds).size !== selectedIds.length) throw Object.assign(new Error('Invitation item IDs must be unique.'), { status: 400 });
    const selected = items.filter((item: any) => selectedIds.includes(item.id));
    if (selected.length !== selectedIds.length) throw Object.assign(new Error('Every resend item must belong to the selected batch.'), { status: 409 });
    items = selected;
  }
  const attempts = await db.select().from(clubSeasonInvitationDeliveryAttempts).where(eq(clubSeasonInvitationDeliveryAttempts.batchId, batchId)).orderBy(asc(clubSeasonInvitationDeliveryAttempts.attemptNumber));
  const byItem = new Map<string, any[]>(); for (const attempt of attempts) { if (attempt.batchItemId) byItem.set(attempt.batchItemId, [...(byItem.get(attempt.batchItemId) || []), attempt]); }
  const eligible = items.filter((item: any) => {
    const prior = byItem.get(item.id) || []; const last = latestInvitationAttempt(prior);
    return mode === 'initial' ? prior.length === 0 : mode === 'retry' ? last?.status === 'failed' : prior.some((entry: any) => entry.status === 'sent');
  }).slice(0, 50);
  if (mode === 'resend' && eligible.length !== items.length) throw Object.assign(new Error('Every deliberate resend item must have a previously successful send.'), { status: 409 });
  const results: any[] = [];
  for (const item of eligible) {
    const prior = byItem.get(item.id) || []; const attemptNumber = prior.length + 1;
    const key = `club-invite-${batchId}-${item.id}-${attemptNumber}`; const attemptId = crypto.randomUUID(); const now = new Date().toISOString();
    const inserted = await db.insert(clubSeasonInvitationDeliveryAttempts).values({ id: attemptId, batchId, batchItemId: item.id, attemptNumber, recipientEmail: item.recipientEmail, idempotencyKey: key, status: 'pending', adminUserId: admin.id, attemptedAt: now, createdAt: now }).onConflictDoNothing().returning({ id: clubSeasonInvitationDeliveryAttempts.id });
    if (!inserted[0]) { results.push({ itemId: item.id, recipient: item.recipientEmail, status: 'skipped' }); continue; }
    const rendered = renderClubSeasonInvitationEmail({ parentName: item.parentName, playerName: item.playerName, teamName: item.teamName, acceptanceDeadline: item.acceptanceDeadline, totalAmount: item.totalAmount, depositAmount: item.depositAmount, installmentAmount: item.installmentAmount, installmentCount: item.installmentCount, installmentDates: JSON.parse(item.scheduleSnapshot) });
    try {
      const sent: any = await sender({ to: item.recipientEmail, subject: rendered.subject, html: rendered.html, idempotencyKey: key });
      const providerMessageId = requireAcceptedProviderResult(sent);
      await db.update(clubSeasonInvitationDeliveryAttempts).set({ status: 'sent', providerMessageId, resolvedAt: new Date().toISOString() }).where(eq(clubSeasonInvitationDeliveryAttempts.id, attemptId));
      results.push({ itemId: item.id, recipient: item.recipientEmail, status: 'sent' });
    } catch (error) {
      const message = safeError(error);
      await db.update(clubSeasonInvitationDeliveryAttempts).set({ status: 'failed', errorMessage: message, resolvedAt: new Date().toISOString() }).where(eq(clubSeasonInvitationDeliveryAttempts.id, attemptId));
      results.push({ itemId: item.id, recipient: item.recipientEmail, status: 'failed', error: message });
    }
  }
  const allAttempts = await db.select().from(clubSeasonInvitationDeliveryAttempts).where(eq(clubSeasonInvitationDeliveryAttempts.batchId, batchId));
  const current = summarizeInvitationItems(allItems.map((item: any) => ({ attempts: allAttempts.filter((attempt: any) => attempt.batchItemId === item.id) })));
  const status = current.failed ? 'partial' : current.unsent || current.pending ? 'sending' : 'completed';
  await db.update(clubSeasonInvitationBatches).set({ status, completedAt: new Date().toISOString() }).where(eq(clubSeasonInvitationBatches.id, batchId));
  await db.insert(clubSeasonAdminAuditLog).values({ id: crypto.randomUUID(), adminUserId: admin.id, action: mode === 'initial' ? 'invitation_batch_sent' : mode === 'retry' ? 'invitation_failed_retried' : 'invitation_sent_resent', entityType: 'club_season_invitation_batch', entityId: batchId, reason: mode === 'initial' ? 'Confirmed initial invitation send.' : mode === 'retry' ? 'Confirmed retry of current failed invitations.' : 'Confirmed deliberate resend.', beforeSnapshot: null, afterSnapshot: JSON.stringify({ mode, results, current }), createdAt: new Date().toISOString() });
  return { batchId, results, skipped: items.length - eligible.length };
}

export const sendInvitationBatch = (db: Database, admin: Admin, batchId: string, sender: EmailSender = sendEmail) => sendItems(db, admin, batchId, 'initial', undefined, sender);
export const retryFailedInvitations = (db: Database, admin: Admin, batchId: string, sender: EmailSender = sendEmail) => sendItems(db, admin, batchId, 'retry', undefined, sender);
export const resendSentInvitations = async (db: Database, admin: Admin, batchId: string, itemIds: string[], reason: string, sender: EmailSender = sendEmail) => {
  const result = await sendItems(db, admin, batchId, 'resend', itemIds, sender);
  await db.insert(clubSeasonAdminAuditLog).values({ id: crypto.randomUUID(), adminUserId: admin.id, action: 'invitation_deliberately_resent', entityType: 'club_season_invitation_batch', entityId: batchId, reason, beforeSnapshot: null, afterSnapshot: JSON.stringify({ itemIds }), createdAt: new Date().toISOString() });
  return result;
};

export async function invitationHistory(db: Database, seasonId: string, wave: string) {
  const batches = await db.select().from(clubSeasonInvitationBatches).where(and(eq(clubSeasonInvitationBatches.seasonId, seasonId), eq(clubSeasonInvitationBatches.wave, wave))).orderBy(desc(clubSeasonInvitationBatches.createdAt)).limit(30);
  if (!batches.length) return { batches: [] };
  const ids = batches.map((batch: any) => batch.id);
  const [items, attempts] = await Promise.all([
    db.select().from(clubSeasonInvitationBatchItems).where(inArray(clubSeasonInvitationBatchItems.batchId, ids)),
    db.select().from(clubSeasonInvitationDeliveryAttempts).where(inArray(clubSeasonInvitationDeliveryAttempts.batchId, ids)).orderBy(desc(clubSeasonInvitationDeliveryAttempts.attemptedAt)),
  ]);
  return { batches: batches.map((batch: any) => {
    const batchItems = items.filter((item: any) => item.batchId === batch.id).map((item: any) => ({ ...item, attempts: attempts.filter((attempt: any) => attempt.batchItemId === item.id) }));
    return { ...batch, current: summarizeInvitationItems(batchItems), items: batchItems, testAttempts: attempts.filter((attempt: any) => attempt.batchId === batch.id && !attempt.batchItemId) };
  }) };
}
