import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const root = process.cwd();

function migrationHashes(source: Buffer) {
  const rawHash = crypto.createHash('sha256').update(source).digest('hex');
  const lfNormalizedHash = crypto
    .createHash('sha256')
    .update(source.toString('utf8').replaceAll('\r\n', '\n'))
    .digest('hex');

  return new Set([rawHash, lfNormalizedHash]);
}

test('production baseline records exact repository migrations and is rerunnable', async () => {
  const databasePath = path.join(root, 'test-results', `production-migration-baseline-${process.pid}.db`);
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.rm(databasePath, { force: true });
  const client = createClient({ url: `file:${databasePath.replaceAll('\\', '/')}` });
  try {
    const journal = JSON.parse(await fs.readFile(path.join(root, 'drizzle/meta/_journal.json'), 'utf8'));
    const historicalBaselineEntries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 12);
    for (const entry of historicalBaselineEntries) {
      const sql = (await fs.readFile(path.join(root, 'drizzle', `${entry.tag}.sql`), 'utf8'))
        .replaceAll('--> statement-breakpoint', '');
      await client.executeMultiple(sql);
    }

    const missingProductionIndexes = [
      'club_age_groups_pricing_tier_id_idx',
      'club_age_groups_season_code_unique',
      'club_pricing_tiers_active_idx',
      'club_pricing_tiers_season_key_unique',
      'club_season_agreements_one_published_key_unique',
      'club_season_agreements_status_idx',
      'club_season_payment_transactions_event_unique',
      'club_season_payment_transactions_intent_unique',
      'club_season_payment_transactions_registration_id_idx',
      'club_season_payment_transactions_session_unique',
    ];
    for (const indexName of missingProductionIndexes) {
      await client.execute(`DROP INDEX ${indexName}`);
    }

    const productionShapeCounts = await client.execute(`
      SELECT
        sum(type = 'table' AND name LIKE 'club_%') AS tables,
        sum(type = 'trigger' AND name LIKE 'club_%') AS triggers,
        sum(type = 'index' AND name LIKE 'club_%') AS indexes
      FROM sqlite_master
    `);
    assert.deepEqual(productionShapeCounts.rows[0], { tables: 19, triggers: 27, indexes: 64 });

    const repair = await fs.readFile(
      path.join(root, 'scripts/repair-production-club-season-indexes.sql'),
      'utf8'
    );
    await client.executeMultiple(repair);
    await client.executeMultiple(repair);

    const repairedSchemaCounts = await client.execute(`
      SELECT
        sum(type = 'table' AND name LIKE 'club_%') AS tables,
        sum(type = 'trigger' AND name LIKE 'club_%') AS triggers,
        sum(type = 'index' AND name LIKE 'club_%') AS indexes
      FROM sqlite_master
    `);
    assert.deepEqual(repairedSchemaCounts.rows[0], { tables: 19, triggers: 27, indexes: 74 });

    const baseline = await fs.readFile(
      path.join(root, 'scripts/baseline-production-migrations-0000-0012.sql'),
      'utf8'
    );
    await client.executeMultiple(baseline);
    await client.executeMultiple(baseline);

    const result = await client.execute(
      'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at'
    );
    assert.equal(result.rows.length, historicalBaselineEntries.length);
    for (const [index, entry] of historicalBaselineEntries.entries()) {
      const source = await fs.readFile(path.join(root, 'drizzle', `${entry.tag}.sql`));
      assert.equal(result.rows[index].created_at, entry.when);
      assert.ok(
        migrationHashes(source).has(String(result.rows[index].hash)),
        `baseline hash for ${entry.tag} must match the committed migration content`
      );
    }

    for (const entry of journal.entries.filter((item: { idx: number }) => item.idx > 12)) {
      const sql = (await fs.readFile(path.join(root, 'drizzle', `${entry.tag}.sql`), 'utf8'))
        .replaceAll('--> statement-breakpoint', '');
      await client.executeMultiple(sql);
    }
    const currentShape = await client.execute(`
      SELECT
        sum(type = 'table' AND name LIKE 'club_%') AS tables,
        sum(type = 'trigger' AND name LIKE 'club_%') AS triggers,
        sum(type = 'index' AND name LIKE 'club_%') AS indexes
      FROM sqlite_master
    `);
    assert.deepEqual(currentShape.rows[0], { tables: 23, triggers: 35, indexes: 94 });
  } finally {
    await client.close();
  }
});
