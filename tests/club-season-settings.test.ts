import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../src/db/index.ts';
import {
  clubSeasonAdminAuditLog,
  clubSeasonAgreementVersions,
  clubSeasonLaunchEvidence,
  clubSeasons,
} from '../src/db/schema.ts';
import {
  createClubSeasonAgreementDraft,
  CLUB_SEASON_PILOT_CHECKS,
  getClubSeasonLaunchEvidence,
  getClubSeasonRegistrationWindowState,
  hashClubSeasonAgreement,
  publishClubSeasonAgreement,
  recordClubSeasonLaunchEvidence,
  recordLaunchEvidenceSchema,
  setClubSeasonRegistrationAccess,
  setRegistrationAccessSchema,
  updateClubSeasonAgreementDraft,
  updateClubSeasonRegistrationWindow,
} from '../src/lib/club-season-settings.ts';

const databasePath = path.join(process.cwd(), 'test-results', 'club-season-settings.db');
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;

async function removeDatabase() {
  const options = { force: true, maxRetries: 5, retryDelay: 50 };
  await fs.rm(databasePath, options);
  await fs.rm(`${databasePath}-shm`, options);
  await fs.rm(`${databasePath}-wal`, options);
}

test('registration window state is inclusive and rejects incomplete configuration', () => {
  const season = {
    registrationOpensAt: '2026-11-02T17:00:00.000Z',
    registrationClosesAt: '2026-11-30T07:59:59.000Z',
  };
  assert.equal(getClubSeasonRegistrationWindowState(season, new Date('2026-11-02T16:59:59.999Z')), 'not_open');
  assert.equal(getClubSeasonRegistrationWindowState(season, new Date(season.registrationOpensAt)), 'open');
  assert.equal(getClubSeasonRegistrationWindowState(season, new Date(season.registrationClosesAt)), 'open');
  assert.equal(getClubSeasonRegistrationWindowState(season, new Date('2026-11-30T08:00:00.000Z')), 'closed');
  assert.equal(getClubSeasonRegistrationWindowState({ registrationOpensAt: null, registrationClosesAt: null }), 'not_configured');
});

test('launch evidence validation requires the exact phrase and complete pilot checklist', () => {
  assert.equal(recordLaunchEvidenceSchema.safeParse({
    action: 'record_launch_evidence', seasonId: 'season', type: 'resend_domain',
    confirmation: 'RECORD RESEND', evidenceReference: 'Resend domain dashboard verified.',
  }).success, true);
  assert.equal(recordLaunchEvidenceSchema.safeParse({
    action: 'record_launch_evidence', seasonId: 'season', type: 'controlled_pilot',
    confirmation: 'RECORD PILOT', evidenceReference: 'Pilot family run on November 1.',
    checks: ['registration'],
  }).success, false);
  assert.equal(recordLaunchEvidenceSchema.safeParse({
    action: 'record_launch_evidence', seasonId: 'season', type: 'stripe_live_review',
    confirmation: 'record stripe', evidenceReference: 'Stripe dashboard live review complete.',
  }).success, false);
});

test('registration access validation requires an actual transition and exact phrase', () => {
  assert.equal(setRegistrationAccessSchema.safeParse({
    action: 'set_registration_access', seasonId: 'season', enabled: true, expectedEnabled: false,
    confirmation: 'OPEN REGISTRATION', reason: 'Opening the first invitation wave.',
  }).success, true);
  assert.equal(setRegistrationAccessSchema.safeParse({
    action: 'set_registration_access', seasonId: 'season', enabled: true, expectedEnabled: false,
    confirmation: 'open registration', reason: 'Opening the first invitation wave.',
  }).success, false);
  assert.equal(setRegistrationAccessSchema.safeParse({
    action: 'set_registration_access', seasonId: 'season', enabled: false, expectedEnabled: false,
    confirmation: 'CLOSE REGISTRATION', reason: 'Emergency close after a payment mismatch.',
  }).success, false);
});

test('registration windows and agreement publication preserve an audited immutable version history', async () => {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await removeDatabase();
  const client = createClient({ url: databaseUrl });
  try {
    const files = (await fs.readdir(path.join(process.cwd(), 'drizzle')))
      .filter((file) => /^\d+.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const migration = (await fs.readFile(path.join(process.cwd(), 'drizzle', file), 'utf8'))
        .replaceAll('--> statement-breakpoint', '');
      await client.executeMultiple(migration);
    }
    await client.execute({
      sql: `INSERT INTO user (id,name,email,role) VALUES ('settings-admin','TVVC Admin','admin@tvvc.test','admin')`,
      args: [],
    });
    const db = getDb(databaseUrl);

    const season = await updateClubSeasonRegistrationWindow(db, {
      seasonId: '2026-2027-club',
      registrationOpensAt: '2026-11-02T17:00:00.000Z',
      registrationClosesAt: '2026-11-30T07:59:59.000Z',
      reason: 'Approved registration window for the 2026 tryout cycle',
      adminUserId: 'settings-admin',
    });
    assert.equal(season.registrationOpensAt, '2026-11-02T17:00:00.000Z');
    assert.equal(season.registrationClosesAt, '2026-11-30T07:59:59.000Z');

    await assert.rejects(setClubSeasonRegistrationAccess(db, {
      seasonId: '2026-2027-club', enabled: true, expectedEnabled: false,
      confirmation: 'OPEN REGISTRATION', reason: 'This incomplete launch must remain blocked.',
      adminUserId: 'settings-admin',
      environment: {
        featureFlagEnabled: false,
        stripeSecretKey: 'sk_test_settings',
        stripePublishableKey: 'pk_test_settings',
        stripeWebhookSecret: 'whsec_settings',
        resendApiKey: 're_settings',
        cronSecret: 's'.repeat(32),
        billingEmail: 'billing@tualatinvalleyvb.com',
      },
    }), /REGISTRATION_OPEN_BLOCKED/);

    const resendEvidence = await recordClubSeasonLaunchEvidence(db, {
      seasonId: '2026-2027-club',
      type: 'resend_domain',
      confirmation: 'RECORD RESEND',
      evidenceReference: 'Resend dashboard shows the TVVC sending domain as verified.',
      adminUserId: 'settings-admin',
    });
    assert.equal(resendEvidence.type, 'resend_domain');
    await assert.rejects(recordClubSeasonLaunchEvidence(db, {
      seasonId: '2026-2027-club',
      type: 'resend_domain',
      confirmation: 'RECORD RESEND',
      evidenceReference: 'A duplicate record must never replace the original evidence.',
      adminUserId: 'settings-admin',
    }), /LAUNCH_EVIDENCE_ALREADY_RECORDED/);
    await assert.rejects(recordClubSeasonLaunchEvidence(db, {
      seasonId: '2026-2027-club',
      type: 'controlled_pilot',
      confirmation: 'RECORD PILOT',
      evidenceReference: 'Incomplete pilot run for validation coverage.',
      checks: ['registration'],
      adminUserId: 'settings-admin',
    }), /PILOT_CHECKLIST_INCOMPLETE/);
    await recordClubSeasonLaunchEvidence(db, {
      seasonId: '2026-2027-club',
      type: 'controlled_pilot',
      confirmation: 'RECORD PILOT',
      evidenceReference: 'Controlled test-family run reconciled against Stripe, email, and the ledger.',
      checks: [...CLUB_SEASON_PILOT_CHECKS],
      adminUserId: 'settings-admin',
    });
    const launchEvidence = await getClubSeasonLaunchEvidence(db, '2026-2027-club');
    assert.equal(launchEvidence.length, 3);
    assert.deepEqual(
      launchEvidence.map((item) => [item.type, item.completed]),
      [['resend_domain', true], ['stripe_live_review', false], ['controlled_pilot', true]]
    );
    assert.equal(launchEvidence[0].completedByName, 'TVVC Admin');
    assert.equal(launchEvidence[0].completedByEmail, 'admin@tvvc.test');
    await assert.rejects(client.execute({
      sql: 'UPDATE club_season_launch_evidence SET evidence_reference = ? WHERE id = ?',
      args: ['Rewritten evidence', resendEvidence.id],
    }), /immutable/i);
    await assert.rejects(client.execute({
      sql: 'DELETE FROM club_season_launch_evidence WHERE id = ?',
      args: [resendEvidence.id],
    }), /cannot be deleted/i);
    const storedEvidence = await db.select().from(clubSeasonLaunchEvidence);
    assert.equal(storedEvidence.length, 2);

    const firstDraft = await createClubSeasonAgreementDraft(db, {
      seasonId: '2026-2027-club',
      key: 'refund-cancellation-policy',
      title: 'Refund and cancellation policy',
      summary: 'Case-by-case withdrawals and approved refunds',
      body: 'First approved working body with sufficient text for the agreement integrity check.',
      adminUserId: 'settings-admin',
    });
    assert.equal(firstDraft.version, 1);
    assert.equal(firstDraft.status, 'draft');
    assert.equal(firstDraft.responseType, 'acknowledgement');
    assert.equal(firstDraft.contentHash, await hashClubSeasonAgreement({
      key: firstDraft.key, version: firstDraft.version, title: firstDraft.title, body: firstDraft.body,
    }));

    await assert.rejects(createClubSeasonAgreementDraft(db, {
      seasonId: '2026-2027-club', key: 'refund-cancellation-policy',
      title: 'Duplicate draft', body: 'This duplicate draft must not be created in the same family.',
      adminUserId: 'settings-admin',
    }), /AGREEMENT_DRAFT_EXISTS/);

    const updatedDraft = await updateClubSeasonAgreementDraft(db, {
      agreementId: firstDraft.id,
      title: 'TVVC refund and cancellation policy',
      summary: 'Cancellation, withdrawal, and approved refund rules',
      body: 'Final approved version one body with the exact policy text families will review.',
      adminUserId: 'settings-admin',
    });
    assert.notEqual(updatedDraft.contentHash, firstDraft.contentHash);

    await assert.rejects(publishClubSeasonAgreement(db, {
      agreementId: firstDraft.id,
      confirmation: 'PUBLISH',
      approvalReference: 'Board approval recorded in meeting minutes dated October 15, 2026.',
      adminUserId: 'settings-admin',
    }), /PUBLISH_CONFIRMATION_MISMATCH/);

    const publishedV1 = await publishClubSeasonAgreement(db, {
      agreementId: firstDraft.id,
      confirmation: 'PUBLISH V1',
      approvalReference: 'Board approval recorded in meeting minutes dated October 15, 2026.',
      adminUserId: 'settings-admin',
    });
    assert.equal(publishedV1.status, 'published');
    await assert.rejects(updateClubSeasonAgreementDraft(db, {
      agreementId: firstDraft.id,
      title: 'Rewritten published title',
      body: 'Published evidence must never be rewritten after it becomes visible to families.',
      adminUserId: 'settings-admin',
    }), /AGREEMENT_DRAFT_NOT_FOUND/);

    const secondDraft = await createClubSeasonAgreementDraft(db, {
      seasonId: '2026-2027-club',
      key: 'refund-cancellation-policy',
      title: 'TVVC refund and cancellation policy',
      summary: 'Updated cancellation, withdrawal, and refund rules',
      body: 'Approved version two body that replaces version one without changing its evidence.',
      adminUserId: 'settings-admin',
    });
    assert.equal(secondDraft.version, 2);
    await publishClubSeasonAgreement(db, {
      agreementId: secondDraft.id,
      confirmation: 'PUBLISH V2',
      approvalReference: 'Updated policy approved by TVVC board vote on November 1, 2026.',
      adminUserId: 'settings-admin',
    });

    const versions = await db.select().from(clubSeasonAgreementVersions).where(and(
      eq(clubSeasonAgreementVersions.seasonId, '2026-2027-club'),
      eq(clubSeasonAgreementVersions.key, 'refund-cancellation-policy')
    ));
    assert.deepEqual(versions.map((item) => ({ version: item.version, status: item.status })), [
      { version: 1, status: 'retired' },
      { version: 2, status: 'published' },
    ]);
    assert.equal(versions.filter((item) => item.status === 'published').length, 1);
    await assert.rejects(client.execute({
      sql: `UPDATE club_season_agreement_versions SET body='tampered' WHERE id=?`,
      args: [secondDraft.id],
    }), /immutable/i);

    const commitmentDraft = await createClubSeasonAgreementDraft(db, {
      seasonId: '2026-2027-club',
      key: 'season-commitment',
      title: 'Club season participation commitment',
      summary: 'Attendance, communication, and team participation',
      body: 'Families acknowledge the complete club season participation and communication expectations.',
      adminUserId: 'settings-admin',
    });
    await publishClubSeasonAgreement(db, {
      agreementId: commitmentDraft.id,
      confirmation: 'PUBLISH V1',
      approvalReference: 'Season commitment approved for guarded registration access testing.',
      adminUserId: 'settings-admin',
    });
    await recordClubSeasonLaunchEvidence(db, {
      seasonId: '2026-2027-club',
      type: 'stripe_live_review',
      confirmation: 'RECORD STRIPE',
      evidenceReference: 'Stripe live keys, pricing, webhooks, receipts, and payment methods reviewed.',
      adminUserId: 'settings-admin',
    });
    await client.batch([
      { sql: `UPDATE club_seasons SET status='active' WHERE id='2026-2027-club'`, args: [] },
      { sql: `INSERT INTO club_teams (id, season_id, age_group_id, name, active) VALUES ('settings-team', '2026-2027-club', 'age-2026-2027-12u', '12U Settings', 1)`, args: [] },
    ]);

    const liveEnvironment = {
      featureFlagEnabled: true,
      stripeSecretKey: 'sk_live_settings',
      stripePublishableKey: 'pk_live_settings',
      stripeWebhookSecret: 'whsec_settings',
      resendApiKey: 're_settings',
      cronSecret: 's'.repeat(32),
      billingEmail: 'billing@tualatinvalleyvb.com',
    };
    const opened = await setClubSeasonRegistrationAccess(db, {
      seasonId: '2026-2027-club', enabled: true, expectedEnabled: false,
      confirmation: 'OPEN REGISTRATION', reason: 'Opening the reviewed invitation wave.',
      adminUserId: 'settings-admin', environment: liveEnvironment,
    });
    assert.equal(opened.season.publicRegistrationEnabled, true);
    assert.equal(opened.readiness?.readyToOpenRegistration, true);

    await client.execute(`UPDATE club_seasons SET public_registration_enabled=0 WHERE id='2026-2027-club'`);
    await assert.rejects(setClubSeasonRegistrationAccess(db, {
      seasonId: '2026-2027-club', enabled: false, expectedEnabled: true,
      confirmation: 'CLOSE REGISTRATION', reason: 'Testing stale concurrent state protection.',
      adminUserId: 'settings-admin', environment: liveEnvironment,
    }), /REGISTRATION_ACCESS_STATE_CHANGED/);
    await client.execute(`UPDATE club_seasons SET public_registration_enabled=1 WHERE id='2026-2027-club'`);

    const closed = await setClubSeasonRegistrationAccess(db, {
      seasonId: '2026-2027-club', enabled: false, expectedEnabled: true,
      confirmation: 'CLOSE REGISTRATION', reason: 'Emergency close preserves all existing records.',
      adminUserId: 'settings-admin', environment: liveEnvironment,
    });
    assert.equal(closed.season.publicRegistrationEnabled, false);

    const audits = await db.select().from(clubSeasonAdminAuditLog);
    assert.equal(audits.filter((item) => item.action === 'registration_window_updated').length, 1);
    assert.equal(audits.filter((item) => item.action === 'agreement_published').length, 3);
    assert.equal(audits.filter((item) => item.action === 'registration_access_opened').length, 1);
    assert.equal(audits.filter((item) => item.action === 'registration_access_closed').length, 1);
    assert.match(
      audits.find((item) => item.entityId === secondDraft.id && item.action === 'agreement_published')?.reason || '',
      /board vote/i
    );
    const [storedSeason] = await db.select().from(clubSeasons)
      .where(eq(clubSeasons.id, '2026-2027-club'));
    assert.equal(storedSeason.publicRegistrationEnabled, false);
  } finally {
    client.close();
    await removeDatabase().catch(() => {});
  }
});
