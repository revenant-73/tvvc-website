import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const root = process.cwd();

test('production club-season foundation is exact and rerunnable without opening registration', async () => {
  const databasePath = path.join(root, 'test-results', `production-club-season-foundation-${process.pid}.db`);
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.rm(databasePath, { force: true });
  const client = createClient({ url: `file:${databasePath.replaceAll('\\', '/')}` });
  try {
    const migration = (await fs.readFile(path.join(root, 'drizzle/0004_overrated_groot.sql'), 'utf8'))
      .replaceAll('--> statement-breakpoint', '');
    await client.executeMultiple(migration);
    await client.execute(`DELETE FROM club_age_groups WHERE season_id = '2026-2027-club'`);
    await client.execute(`DELETE FROM club_pricing_tiers WHERE season_id = '2026-2027-club'`);

    const reconciliation = await fs.readFile(
      path.join(root, 'scripts/reconcile-production-club-season-foundation.sql'),
      'utf8'
    );
    await client.executeMultiple(reconciliation);
    await client.executeMultiple(reconciliation);

    const season = await client.execute(`
      SELECT status, default_billing_day, first_installment_date,
        standard_installment_count, public_registration_enabled
      FROM club_seasons WHERE id = '2026-2027-club'
    `);
    assert.deepEqual(season.rows[0], {
      status: 'draft',
      default_billing_day: 5,
      first_installment_date: '2027-01-05',
      standard_installment_count: 5,
      public_registration_enabled: 0,
    });

    const pricing = await client.execute(`
      SELECT key, total_amount, deposit_amount, installment_amount, active, sort_order
      FROM club_pricing_tiers WHERE season_id = '2026-2027-club' ORDER BY sort_order
    `);
    assert.deepEqual(pricing.rows, [
      { key: '12u', total_amount: 120000, deposit_amount: 30000, installment_amount: 18000, active: 1, sort_order: 10 },
      { key: '13u-18u', total_amount: 150000, deposit_amount: 40000, installment_amount: 22000, active: 1, sort_order: 20 },
    ]);

    const ages = await client.execute(`
      SELECT code, pricing_tier_id, active, sort_order
      FROM club_age_groups WHERE season_id = '2026-2027-club' ORDER BY sort_order
    `);
    assert.equal(ages.rows.length, 7);
    assert.deepEqual(ages.rows.map((row) => row.code), ['12U', '13U', '14U', '15U', '16U', '17U', '18U']);
    assert.equal(ages.rows[0].pricing_tier_id, 'tier-2026-2027-12u');
    assert.ok(ages.rows.slice(1).every((row) => row.pricing_tier_id === 'tier-2026-2027-13u-18u'));
    assert.ok(ages.rows.every((row) => row.active === 1));
  } finally {
    await client.close();
  }
});

test('production club-season foundation refuses conflicting existing pricing', async () => {
  const databasePath = path.join(root, 'test-results', `production-club-season-conflict-${process.pid}.db`);
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.rm(databasePath, { force: true });
  const client = createClient({ url: `file:${databasePath.replaceAll('\\', '/')}` });
  try {
    const migration = (await fs.readFile(path.join(root, 'drizzle/0004_overrated_groot.sql'), 'utf8'))
      .replaceAll('--> statement-breakpoint', '');
    await client.executeMultiple(migration);
    await client.execute(`UPDATE club_pricing_tiers SET total_amount = 1 WHERE key = '12u'`);
    const reconciliation = await fs.readFile(
      path.join(root, 'scripts/reconcile-production-club-season-foundation.sql'),
      'utf8'
    );
    await assert.rejects(client.executeMultiple(reconciliation));
    const result = await client.execute(`SELECT total_amount FROM club_pricing_tiers WHERE key = '12u'`);
    assert.equal(result.rows[0].total_amount, 1);
  } finally {
    await client.close();
  }
});
