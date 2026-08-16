import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const databasePath = path.join(process.cwd(), 'test-results', 'club-season-migration.db');
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;

async function removeDatabase() {
  const options = { force: true, maxRetries: 5, retryDelay: 50 };
  await fs.rm(databasePath, options);
  await fs.rm(`${databasePath}-shm`, options);
  await fs.rm(`${databasePath}-wal`, options);
}

test('creates and seeds the 2026-2027 club season foundation', async () => {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await removeDatabase();

  const client = createClient({ url: databaseUrl });
  try {
    const migrationFiles = (await fs.readdir(path.join(process.cwd(), 'drizzle')))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();

    for (const filename of migrationFiles) {
      const migration = (await fs.readFile(path.join(process.cwd(), 'drizzle', filename), 'utf8'))
        .replaceAll('--> statement-breakpoint', '');
      await client.executeMultiple(migration);
    }

    const season = await client.execute({
      sql: `SELECT id, status, timezone, default_billing_day,
                   first_installment_date, standard_installment_count,
                   public_registration_enabled
            FROM club_seasons
            WHERE id = ?`,
      args: ['2026-2027-club'],
    });
    assert.deepEqual(season.rows[0], {
      id: '2026-2027-club',
      status: 'draft',
      timezone: 'America/Los_Angeles',
      default_billing_day: 5,
      first_installment_date: '2027-01-05',
      standard_installment_count: 5,
      public_registration_enabled: 0,
    });

    const pricing = await client.execute(
      `SELECT key, total_amount, deposit_amount, installment_amount
       FROM club_pricing_tiers
       ORDER BY sort_order`
    );
    assert.deepEqual(pricing.rows, [
      { key: '12u', total_amount: 120_000, deposit_amount: 30_000, installment_amount: 18_000 },
      { key: '13u-18u', total_amount: 150_000, deposit_amount: 40_000, installment_amount: 22_000 },
    ]);

    const ageGroups = await client.execute(
      `SELECT code, pricing_tier_id
       FROM club_age_groups
       ORDER BY sort_order`
    );
    assert.deepEqual(ageGroups.rows, [
      { code: '12U', pricing_tier_id: 'tier-2026-2027-12u' },
      { code: '13U', pricing_tier_id: 'tier-2026-2027-13u-18u' },
      { code: '14U', pricing_tier_id: 'tier-2026-2027-13u-18u' },
      { code: '15U', pricing_tier_id: 'tier-2026-2027-13u-18u' },
      { code: '16U', pricing_tier_id: 'tier-2026-2027-13u-18u' },
      { code: '17U', pricing_tier_id: 'tier-2026-2027-13u-18u' },
      { code: '18U', pricing_tier_id: 'tier-2026-2027-13u-18u' },
    ]);

    const offerTables = await client.execute(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name IN (
         'club_season_agreement_acceptances',
         'club_season_agreement_versions',
         'club_season_admin_audit_log',
         'club_season_email_deliveries',
         'club_season_financial_adjustments',
         'club_season_launch_evidence',
         'club_season_offers',
         'club_season_payment_attempts',
         'club_season_payment_plan_authorizations',
         'club_season_payment_plan_revisions',
         'club_season_payment_installments',
         'club_season_payment_plan_versions',
         'club_season_payment_plans',
         'club_season_payment_transactions',
         'club_season_registrations'
       )
       ORDER BY name`
    );
    assert.deepEqual(offerTables.rows, [
      { name: 'club_season_admin_audit_log' },
      { name: 'club_season_agreement_acceptances' },
      { name: 'club_season_agreement_versions' },
      { name: 'club_season_email_deliveries' },
      { name: 'club_season_financial_adjustments' },
      { name: 'club_season_launch_evidence' },
      { name: 'club_season_offers' },
      { name: 'club_season_payment_attempts' },
      { name: 'club_season_payment_installments' },
      { name: 'club_season_payment_plan_authorizations' },
      { name: 'club_season_payment_plan_revisions' },
      { name: 'club_season_payment_plan_versions' },
      { name: 'club_season_payment_plans' },
      { name: 'club_season_payment_transactions' },
      { name: 'club_season_registrations' },
    ]);

    const offerIndexes = await client.execute(
      `SELECT name FROM sqlite_master
       WHERE type = 'index' AND name IN (
         'club_season_offers_season_athlete_unique',
         'club_season_registrations_offer_id_unique'
       )
       ORDER BY name`
    );
    assert.deepEqual(offerIndexes.rows, [
      { name: 'club_season_offers_season_athlete_unique' },
      { name: 'club_season_registrations_offer_id_unique' },
    ]);
    const revisionIndexes = await client.execute(
      `SELECT name FROM sqlite_master
       WHERE type = 'index' AND name = 'club_season_plan_revisions_one_pending'`
    );
    assert.deepEqual(revisionIndexes.rows, [{ name: 'club_season_plan_revisions_one_pending' }]);

    const draftColumns = await client.execute(`PRAGMA table_info('club_season_registrations')`);
    assert.equal(
      draftColumns.rows.some((column) => column.name === 'draft_schema_version' && column.dflt_value === '1'),
      true
    );
    const installmentColumns = await client.execute(`PRAGMA table_info('club_season_payment_installments')`);
    assert.equal(installmentColumns.rows.some((column) => column.name === 'attempt_count' && column.dflt_value === '0'), true);
    assert.equal(installmentColumns.rows.some((column) => column.name === 'next_attempt_date'), true);
    const planColumns = await client.execute(`PRAGMA table_info('club_season_payment_plans')`);
    assert.equal(planColumns.rows.some((column) => column.name === 'financial_status' && column.dflt_value === "'not_started'"), true);
    const offerColumns = await client.execute(`PRAGMA table_info('club_season_offers')`);
    assert.equal(
      offerColumns.rows.some((column) => column.name === 'offered_at' && Number(column.notnull) === 0),
      true,
      'offer preparation requires offered_at to remain null until release'
    );

    const immutabilityTriggers = await client.execute(
      `SELECT name FROM sqlite_master
       WHERE type = 'trigger' AND name LIKE 'club_season_%_restricted'
       ORDER BY name`
    );
    assert.deepEqual(immutabilityTriggers.rows, [
      { name: 'club_season_acceptance_delete_restricted' },
      { name: 'club_season_acceptance_update_restricted' },
      { name: 'club_season_adjustment_delete_restricted' },
      { name: 'club_season_adjustment_update_restricted' },
      { name: 'club_season_admin_audit_delete_restricted' },
      { name: 'club_season_admin_audit_update_restricted' },
      { name: 'club_season_email_delivery_delete_restricted' },
      { name: 'club_season_installment_delete_restricted' },
      { name: 'club_season_launch_evidence_delete_restricted' },
      { name: 'club_season_launch_evidence_update_restricted' },
      { name: 'club_season_payment_attempt_delete_restricted' },
      { name: 'club_season_payment_transaction_delete_restricted' },
      { name: 'club_season_payment_transaction_update_restricted' },
      { name: 'club_season_payment_version_delete_restricted' },
      { name: 'club_season_plan_authorization_delete_restricted' },
      { name: 'club_season_plan_authorization_update_restricted' },
      { name: 'club_season_plan_revision_delete_restricted' },
      { name: 'club_season_published_agreement_delete_restricted' },
      { name: 'club_season_published_agreement_status_restricted' },
    ]);

    await client.execute({
      sql: `INSERT INTO club_season_agreement_versions
        (id, season_id, key, version, title, body, content_hash, status, published_at)
        VALUES (?, ?, 'refund-policy', 1, 'Refund policy', 'Original text', 'hash-1', 'published', CURRENT_TIMESTAMP)`,
      args: ['agreement-test-v1', '2026-2027-club'],
    });
    await assert.rejects(
      client.execute({
        sql: 'UPDATE club_season_agreement_versions SET body = ? WHERE id = ?',
        args: ['Rewritten text', 'agreement-test-v1'],
      }),
      /immutable/i
    );
    await assert.rejects(
      client.execute({
        sql: 'DELETE FROM club_season_agreement_versions WHERE id = ?',
        args: ['agreement-test-v1'],
      }),
      /cannot be deleted/i
    );
    await assert.rejects(
      client.execute({
        sql: 'UPDATE club_season_agreement_versions SET status = ? WHERE id = ?',
        args: ['draft', 'agreement-test-v1'],
      }),
      /cannot be reopened/i
    );
  } finally {
    client.close();
    // Windows can hold the native SQLite handle briefly after close.
    await removeDatabase().catch(() => {});
  }
});

test('offer preparation migration preserves released data and every existing index and trigger', async () => {
  const preservationPath = path.join(process.cwd(), 'test-results', 'club-season-offer-preparation-migration.db');
  const preservationUrl = `file:${preservationPath.replaceAll('\\', '/')}`;
  await fs.rm(preservationPath, { force: true });
  const client = createClient({ url: preservationUrl });
  try {
    const migrationFiles = (await fs.readdir(path.join(process.cwd(), 'drizzle')))
      .filter((file) => /^00(0\d|1[0-2]).*\.sql$/.test(file))
      .sort();
    for (const filename of migrationFiles) {
      const migration = (await fs.readFile(path.join(process.cwd(), 'drizzle', filename), 'utf8'))
        .replaceAll('--> statement-breakpoint', '');
      await client.executeMultiple(migration);
    }

    await client.batch([
      { sql: `INSERT INTO user (id, email, role) VALUES ('migration-parent', 'migration@example.com', 'user')`, args: [] },
      { sql: `INSERT INTO registrations (id, user_id, parent_name, parent_email, parent_phone, status, total_amount) VALUES ('migration-registration', 'migration-parent', 'Migration Parent', 'migration@example.com', '503-555-0101', 'paid', 5000)`, args: [] },
      { sql: `INSERT INTO athletes (id, registration_id, parent_id, first_name, last_name, grade) VALUES (910001, 'migration-registration', 'migration-parent', 'Existing', 'Offer', '8')`, args: [] },
      { sql: `INSERT INTO athletes (id, registration_id, parent_id, first_name, last_name, grade) VALUES (910002, 'migration-registration', 'migration-parent', 'Future', 'Draft', '8')`, args: [] },
      { sql: `INSERT INTO club_teams (id, season_id, age_group_id, name, active) VALUES ('migration-team', '2026-2027-club', 'age-2026-2027-12u', 'Migration Team', 1)`, args: [] },
      { sql: `INSERT INTO club_season_offers (id, season_id, team_id, source_registration_id, source_athlete_id, recipient_email, recipient_user_id, status, offered_at) VALUES ('existing-offer', '2026-2027-club', 'migration-team', 'migration-registration', 910001, 'migration@example.com', 'migration-parent', 'offered', '2026-11-09T18:00:00.000Z')`, args: [] },
    ]);

    const schemaObjectsBefore = await client.execute(`
      SELECT type, name, sql FROM sqlite_master
      WHERE type IN ('index', 'trigger') AND name NOT LIKE 'sqlite_%'
      ORDER BY type, name
    `);
    const migration = (await fs.readFile(path.join(process.cwd(), 'drizzle', '0013_robust_ezekiel.sql'), 'utf8'))
      .replaceAll('--> statement-breakpoint', '');
    await client.executeMultiple(migration);

    const offered = await client.execute(`SELECT status, offered_at FROM club_season_offers WHERE id = 'existing-offer'`);
    assert.deepEqual(offered.rows[0], { status: 'offered', offered_at: '2026-11-09T18:00:00.000Z' });
    const offerColumns = await client.execute(`PRAGMA table_info('club_season_offers')`);
    assert.equal(offerColumns.rows.some((column) => column.name === 'offered_at' && Number(column.notnull) === 0), true);

    const schemaObjectsAfter = await client.execute(`
      SELECT type, name, sql FROM sqlite_master
      WHERE type IN ('index', 'trigger') AND name NOT LIKE 'sqlite_%'
      ORDER BY type, name
    `);
    assert.deepEqual(schemaObjectsAfter.rows, schemaObjectsBefore.rows);
    await client.execute(`
      INSERT INTO club_season_offers
        (id, season_id, team_id, source_registration_id, source_athlete_id,
         recipient_email, recipient_user_id, status, offered_at)
      VALUES ('future-draft', '2026-2027-club', 'migration-team', 'migration-registration',
              910002, 'migration@example.com', 'migration-parent', 'draft', NULL)
    `);
    const draft = await client.execute(`SELECT status, offered_at FROM club_season_offers WHERE id = 'future-draft'`);
    assert.deepEqual(draft.rows[0], { status: 'draft', offered_at: null });
  } finally {
    client.close();
    await fs.rm(preservationPath, { force: true }).catch(() => {});
  }
});
