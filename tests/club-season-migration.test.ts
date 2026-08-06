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
       WHERE type = 'table' AND name IN ('club_season_offers', 'club_season_registrations')
       ORDER BY name`
    );
    assert.deepEqual(offerTables.rows, [
      { name: 'club_season_offers' },
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
  } finally {
    client.close();
    // Windows can hold the native SQLite handle briefly after close.
    await removeDatabase().catch(() => {});
  }
});
