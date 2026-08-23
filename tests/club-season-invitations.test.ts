import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/index.ts';
import { clubSeasonInvitationBatchItems, clubSeasonInvitationDeliveryAttempts, clubSeasonOffers } from '../src/db/schema.ts';
import { renderClubSeasonInvitationEmail } from '../src/lib/club-season-invitation-email.ts';
import { invitationActionSchema, invitationHistory, isApprovedInvitationTestRecipient, latestInvitationAttempt, releaseInvitations, resendSentInvitations, retryFailedInvitations, sendInvitationBatch, summarizeInvitationItems } from '../src/lib/club-season-invitations.ts';
import { rejectCrossOriginRequest } from '../src/lib/request-security.ts';

const baseModel = {
  parentName: 'Pilot Parent', playerName: 'Pilot Player', teamName: '14U Teal',
  acceptanceDeadline: '2026-11-12', totalAmount: 150_000, depositAmount: 40_000,
  installmentAmount: 22_000, installmentCount: 5,
  installmentDates: ['2027-01-05', '2027-02-05', '2027-03-05', '2027-04-05', '2027-05-05'],
};

test('renders authoritative 13U-18U invitation terms with a December break', () => {
  const result = renderClubSeasonInvitationEmail(baseModel);
  assert.match(result.subject, /Pilot Player.*14U Teal/);
  assert.match(result.html, /\$1,500\.00/);
  assert.match(result.html, /\$400\.00/);
  assert.equal((result.html.match(/\$220\.00/g) || []).length, 5);
  assert.match(result.html, /December break/i);
  assert.doesNotMatch(result.html, /December 5, 2027/);
  for (const month of ['January', 'February', 'March', 'April', 'May']) assert.match(result.html, new RegExp(`${month} 5, 2027`));
  assert.match(result.html, /CEVA\/USAV.*separately/i);
});

test('renders 10U-12U pricing and escapes all family-controlled HTML', () => {
  const result = renderClubSeasonInvitationEmail({ ...baseModel, parentName: '<script>alert(1)</script>', playerName: 'A & B', teamName: '12U <Teal>', totalAmount: 120_000, depositAmount: 30_000, installmentAmount: 18_000 });
  assert.match(result.html, /\$1,200\.00/);
  assert.match(result.html, /\$300\.00/);
  assert.equal((result.html.match(/\$180\.00/g) || []).length, 5);
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.html, /A &amp; B/);
  assert.match(result.html, /12U &lt;Teal&gt;/);
});

test('safe invitation origins accept HTTPS and HTTP localhost only', () => {
  assert.equal(renderClubSeasonInvitationEmail({ ...baseModel, siteOrigin: 'https://preview.example.test/path' }).registrationUrl, 'https://preview.example.test/season-registration');
  assert.equal(renderClubSeasonInvitationEmail({ ...baseModel, siteOrigin: 'http://localhost:4321' }).registrationUrl, 'http://localhost:4321/season-registration');
  assert.equal(renderClubSeasonInvitationEmail({ ...baseModel, siteOrigin: 'ftp://localhost' }).registrationUrl, 'https://tualatinvalleyvb.com/season-registration');
  assert.equal(renderClubSeasonInvitationEmail({ ...baseModel, siteOrigin: 'http://evil.example' }).registrationUrl, 'https://tualatinvalleyvb.com/season-registration');
});

test('strict invitation actions require exact confirmations, reasons, and bounded batches', () => {
  const ids = [crypto.randomUUID()];
  assert.equal(invitationActionSchema.safeParse({ action: 'release', seasonId: 'season', teamId: 'team', wave: 'nov8', offerIds: ids, confirmation: 'RELEASE INVITATIONS', reason: 'Reviewed by the club administrator.', requestIdempotencyKey: crypto.randomUUID() }).success, true);
  assert.equal(invitationActionSchema.safeParse({ action: 'release', seasonId: 'season', teamId: 'team', wave: 'nov8', offerIds: ids, confirmation: 'release invitations', reason: 'Reviewed by the club administrator.', requestIdempotencyKey: crypto.randomUUID() }).success, false);
  assert.equal(invitationActionSchema.safeParse({ action: 'send_batch', batchId: crypto.randomUUID(), confirmation: 'SEND' }).success, false);
  assert.equal(invitationActionSchema.safeParse({ action: 'resend_sent', batchId: crypto.randomUUID(), itemIds: ids, confirmation: 'RESEND SENT INVITATIONS', reason: 'short' }).success, false);
  assert.equal(invitationActionSchema.safeParse({ action: 'preview', offerId: ids[0], arbitrary: true }).success, false);
});

test('test sends are restricted to the signed-in administrator or billing address', () => {
  assert.equal(isApprovedInvitationTestRecipient('ADMIN@TVVC.TEST', 'admin@tvvc.test', 'billing@tvvc.test'), true);
  assert.equal(isApprovedInvitationTestRecipient('billing@tvvc.test', 'admin@tvvc.test', 'billing@tvvc.test'), true);
  assert.equal(isApprovedInvitationTestRecipient('parent@example.com', 'admin@tvvc.test', 'billing@tvvc.test'), false);
});

test('latest-attempt summaries treat a successful retry as the current truth', () => {
  const attempts = [{ status: 'failed', attemptNumber: 1 }, { status: 'sent', attemptNumber: 2 }];
  assert.equal(latestInvitationAttempt(attempts)?.status, 'sent');
  assert.deepEqual(summarizeInvitationItems([{ attempts }, { attempts: [] }, { attempts: [{ status: 'pending', attemptNumber: 1 }] }]), { total: 3, unsent: 1, pending: 1, sent: 1, failed: 0 });
});

test('cross-origin invitation writes are rejected before authorization or body parsing', () => {
  const rejected = rejectCrossOriginRequest(new Request('https://tualatinvalleyvb.com/api/admin/club-season-invitations', { method: 'POST', headers: { Origin: 'https://attacker.example', 'Sec-Fetch-Site': 'cross-site' } }));
  assert.equal(rejected?.status, 403);
  const allowed = rejectCrossOriginRequest(new Request('https://tualatinvalleyvb.com/api/admin/club-season-invitations', { method: 'POST', headers: { Origin: 'https://tualatinvalleyvb.com', 'Sec-Fetch-Site': 'same-origin' } }));
  assert.equal(allowed, null);
});

async function createServiceDatabase(name: string) {
  const databasePath = path.join(process.cwd(), 'test-results', `${name}-${process.pid}.db`);
  await fs.mkdir(path.dirname(databasePath), { recursive: true }); await fs.rm(databasePath, { force: true });
  const url = `file:${databasePath.replaceAll('\\', '/')}`; const client = createClient({ url });
  const files = (await fs.readdir(path.join(process.cwd(), 'drizzle'))).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  for (const file of files) await client.executeMultiple((await fs.readFile(path.join(process.cwd(), 'drizzle', file), 'utf8')).replaceAll('--> statement-breakpoint', ''));
  await client.batch([
    { sql: `INSERT INTO user (id,email,role) VALUES ('invite-admin','admin@tvvc.test','admin'),('parent-a','parent-a@test.invalid','user'),('parent-b','parent-b@test.invalid','user')`, args: [] },
    { sql: `UPDATE club_seasons SET status='active', public_registration_enabled=1 WHERE id='2026-2027-club'`, args: [] },
    { sql: `INSERT INTO club_teams (id,season_id,age_group_id,name,active) VALUES ('team-a','2026-2027-club','age-2026-2027-14u','14U Teal',1),('team-b','2026-2027-club','age-2026-2027-14u','14U Coral',1)`, args: [] },
    { sql: `INSERT INTO registrations (id,user_id,parent_name,parent_email,parent_phone,status,total_amount) VALUES ('reg-a','parent-a','Parent A','parent-a@test.invalid','503-555-0101','paid',5000),('reg-b','parent-b','Parent B','parent-b@test.invalid','503-555-0102','paid',5000)`, args: [] },
    { sql: `INSERT INTO athletes (id,registration_id,parent_id,first_name,last_name,grade) VALUES (920001,'reg-a','parent-a','Player','Alpha','8'),(920002,'reg-b','parent-b','Player','Beta','8')`, args: [] },
    { sql: `INSERT INTO club_season_offers (id,season_id,team_id,source_registration_id,source_athlete_id,recipient_email,recipient_user_id,status,acceptance_deadline,created_by_user_id,offered_at) VALUES ('11111111-1111-4111-8111-111111111111','2026-2027-club','team-a','reg-a',920001,'parent-a@test.invalid','parent-a','ready','2026-11-12','invite-admin',NULL),('22222222-2222-4222-8222-222222222222','2026-2027-club','team-b','reg-b',920002,'parent-b@test.invalid','parent-b','ready','2026-11-12','invite-admin',NULL)`, args: [] },
  ]);
  return { databasePath, client, db: getDb(url), admin: { id: 'invite-admin', email: 'admin@tvvc.test' } };
}

test('release is team-scoped, atomic, idempotent, and conflict-safe', async () => {
  const fixture = await createServiceDatabase('invitation-release-service'); const priorFlag = process.env.CLUB_SEASON_REGISTRATION_ENABLED; process.env.CLUB_SEASON_REGISTRATION_ENABLED = 'true';
  try {
    const mixed = { action: 'release' as const, seasonId: '2026-2027-club', teamId: 'team-a', wave: 'nov8' as const, offerIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'], confirmation: 'RELEASE INVITATIONS' as const, reason: 'Reviewed mixed team rollback request.', requestIdempotencyKey: crypto.randomUUID() };
    await assert.rejects(releaseInvitations(fixture.db, fixture.admin, mixed), /selected team/i);
    const statuses = await fixture.db.select({ id: clubSeasonOffers.id, status: clubSeasonOffers.status }).from(clubSeasonOffers);
    assert.deepEqual(statuses.map((row) => row.status), ['ready', 'ready']);
    await assert.rejects(releaseInvitations(fixture.db, fixture.admin, { ...mixed, offerIds: [mixed.offerIds[0], mixed.offerIds[0]], requestIdempotencyKey: crypto.randomUUID() }), /unique/i);
    const key = crypto.randomUUID(); const exact = { ...mixed, offerIds: [mixed.offerIds[0]], requestIdempotencyKey: key };
    const first = await releaseInvitations(fixture.db, fixture.admin, exact); const repeated = await releaseInvitations(fixture.db, fixture.admin, exact);
    assert.equal(repeated.repeated, true); assert.equal(repeated.batch.id, first.batchId);
    await assert.rejects(releaseInvitations(fixture.db, fixture.admin, { ...exact, teamId: 'team-b', offerIds: [mixed.offerIds[1]] }), /different release/i);
  } finally { process.env.CLUB_SEASON_REGISTRATION_ENABLED = priorFlag; fixture.client.close(); await fs.rm(fixture.databasePath, { force: true }).catch(() => {}); }
});

test('send suppression, lock rechecks, retry/resend numbering, latest state, and foreign item rejection', async () => {
  const fixture = await createServiceDatabase('invitation-send-service'); const priorFlag = process.env.CLUB_SEASON_REGISTRATION_ENABLED; const priorPlaywright = process.env.PLAYWRIGHT_TEST; process.env.CLUB_SEASON_REGISTRATION_ENABLED = 'true'; delete process.env.PLAYWRIGHT_TEST;
  try {
    const released = await releaseInvitations(fixture.db, fixture.admin, { action: 'release', seasonId: '2026-2027-club', teamId: 'team-a', wave: 'nov8', offerIds: ['11111111-1111-4111-8111-111111111111'], confirmation: 'RELEASE INVITATIONS', reason: 'Reviewed single-team invitation release.', requestIdempotencyKey: crypto.randomUUID() });
    let calls = 0; const failingSender = async () => { calls += 1; throw new Error('provider failed'); };
    const [one, two] = await Promise.all([sendInvitationBatch(fixture.db, fixture.admin, released.batchId, failingSender as any), sendInvitationBatch(fixture.db, fixture.admin, released.batchId, failingSender as any)]);
    assert.equal(calls, 1); assert.equal([...one.results, ...two.results].filter((row) => row.status === 'failed').length, 1);
    let history = await invitationHistory(fixture.db, '2026-2027-club', 'nov8'); assert.deepEqual(history.batches[0].current, { total: 1, unsent: 0, pending: 0, sent: 0, failed: 1 });
    await fixture.client.execute(`UPDATE club_seasons SET public_registration_enabled=0 WHERE id='2026-2027-club'`);
    await assert.rejects(retryFailedInvitations(fixture.db, fixture.admin, released.batchId, (async () => ({ id: 'should-not-send' })) as any), /paused/i);
    await fixture.client.execute(`UPDATE club_seasons SET public_registration_enabled=1 WHERE id='2026-2027-club'`);
    await retryFailedInvitations(fixture.db, fixture.admin, released.batchId, (async () => ({ id: 'retry-ok' })) as any);
    history = await invitationHistory(fixture.db, '2026-2027-club', 'nov8'); assert.deepEqual(history.batches[0].current, { total: 1, unsent: 0, pending: 0, sent: 1, failed: 0 }); assert.equal(history.batches[0].status, 'completed');
    const item = (await fixture.db.select().from(clubSeasonInvitationBatchItems).where(eq(clubSeasonInvitationBatchItems.batchId, released.batchId)))[0];
    await assert.rejects(resendSentInvitations(fixture.db, fixture.admin, released.batchId, [crypto.randomUUID()], 'Foreign item must be rejected.', (async () => ({ id: 'nope' })) as any), /belong/i);
    await resendSentInvitations(fixture.db, fixture.admin, released.batchId, [item.id], 'Parent requested a deliberate resend.', (async () => ({ id: 'resend-ok' })) as any);
    const attempts = await fixture.db.select().from(clubSeasonInvitationDeliveryAttempts).where(eq(clubSeasonInvitationDeliveryAttempts.batchItemId, item.id)); assert.deepEqual(attempts.map((attempt) => attempt.attemptNumber).sort(), [1, 2, 3]);
    const secondRelease = await releaseInvitations(fixture.db, fixture.admin, { action: 'release', seasonId: '2026-2027-club', teamId: 'team-b', wave: 'nov8', offerIds: ['22222222-2222-4222-8222-222222222222'], confirmation: 'RELEASE INVITATIONS', reason: 'Reviewed provider-result failure case.', requestIdempotencyKey: crypto.randomUUID() });
    const missingProvider = await sendInvitationBatch(fixture.db, fixture.admin, secondRelease.batchId, (async () => undefined) as any); assert.equal(missingProvider.results[0].status, 'failed');
  } finally { process.env.CLUB_SEASON_REGISTRATION_ENABLED = priorFlag; process.env.PLAYWRIGHT_TEST = priorPlaywright; fixture.client.close(); await fs.rm(fixture.databasePath, { force: true }).catch(() => {}); }
});

test('invitation migration creates immutable history tables and preserves existing schema', async () => {
  const databasePath = path.join(process.cwd(), 'test-results', 'club-season-invitations.db');
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.rm(databasePath, { force: true });
  const client = createClient({ url: `file:${databasePath.replaceAll('\\', '/')}` });
  try {
    const files = (await fs.readdir(path.join(process.cwd(), 'drizzle'))).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
    for (const file of files) await client.executeMultiple((await fs.readFile(path.join(process.cwd(), 'drizzle', file), 'utf8')).replaceAll('--> statement-breakpoint', ''));
    const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'club_season_invitation_%' ORDER BY name`);
    assert.deepEqual(tables.rows, [{ name: 'club_season_invitation_batch_items' }, { name: 'club_season_invitation_batches' }, { name: 'club_season_invitation_delivery_attempts' }]);
    const oldIndex = await client.execute(`SELECT name FROM sqlite_master WHERE type='index' AND name='club_season_offers_season_athlete_unique'`);
    assert.equal(oldIndex.rows.length, 1);
    await client.batch([
      { sql: `INSERT INTO user (id,email,role) VALUES ('invite-admin','admin@example.test','admin')`, args: [] },
      { sql: `INSERT INTO club_season_invitation_batches (id,season_id,wave,kind,status,subject,template_fingerprint,request_idempotency_key,request_fingerprint,admin_user_id,audit_reason) VALUES ('batch','2026-2027-club','nov8','test','prepared','Subject','hash','request-key','request-hash','invite-admin','Migration test reason')`, args: [] },
    ]);
    await assert.rejects(client.execute(`UPDATE club_season_invitation_batches SET subject='Changed' WHERE id='batch'`), /immutable/i);
    await assert.rejects(client.execute(`DELETE FROM club_season_invitation_batches WHERE id='batch'`), /immutable/i);
  } finally { client.close(); await fs.rm(databasePath, { force: true }).catch(() => {}); }
});
