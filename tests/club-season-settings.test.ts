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
  clubSeasons,
} from '../src/db/schema.ts';
import {
  createClubSeasonAgreementDraft,
  getClubSeasonRegistrationWindowState,
  hashClubSeasonAgreement,
  publishClubSeasonAgreement,
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

    const audits = await db.select().from(clubSeasonAdminAuditLog);
    assert.equal(audits.filter((item) => item.action === 'registration_window_updated').length, 1);
    assert.equal(audits.filter((item) => item.action === 'agreement_published').length, 2);
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
