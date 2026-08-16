import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const root = process.cwd();

async function createProductionShapedDatabase(suffix: string) {
  const databasePath = path.join(root, 'test-results', `production-club-season-dates-${suffix}-${process.pid}.db`);
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.rm(databasePath, { force: true });
  const client = createClient({ url: `file:${databasePath.replaceAll('\\', '/')}` });
  const journal = JSON.parse(await fs.readFile(path.join(root, 'drizzle/meta/_journal.json'), 'utf8'));
  for (const entry of journal.entries) {
    const sql = (await fs.readFile(path.join(root, 'drizzle', `${entry.tag}.sql`), 'utf8'))
      .replaceAll('--> statement-breakpoint', '');
    await client.executeMultiple(sql);
  }
  await client.execute(`
    INSERT INTO user (id, email, role) VALUES ('admin-dates', 'admin-dates@tvvc.test', 'admin')
  `);
  await client.execute({
    sql: `UPDATE club_seasons SET registration_opens_at = ?, registration_closes_at = ? WHERE id = ?`,
    args: ['2026-11-09T02:00:00.000Z', '2026-12-01T07:59:00.000Z', '2026-2027-club'],
  });
  await client.execute(`
    INSERT INTO club_season_admin_audit_log
      (id, admin_user_id, action, entity_type, entity_id, reason, created_at)
    VALUES
      ('audit-window-dates', 'admin-dates', 'registration_window_updated',
       'club_season', '2026-2027-club', 'Approved invitation window.', '2026-08-16T16:00:00.000Z')
  `);
  return client;
}

test('approved production dates are audited, rerunnable, and preserve both registration locks', async () => {
  const client = await createProductionShapedDatabase('exact');
  try {
    const script = await fs.readFile(
      path.join(root, 'scripts/configure-production-club-season-dates.sql'),
      'utf8'
    );
    await client.executeMultiple(script);
    await client.executeMultiple(script);

    const season = await client.execute(`
      SELECT registration_opens_at, registration_closes_at, season_start_date,
        season_end_date, status, public_registration_enabled
      FROM club_seasons WHERE id = '2026-2027-club'
    `);
    assert.deepEqual(season.rows[0], {
      registration_opens_at: '2026-11-09T02:00:00.000Z',
      registration_closes_at: '2026-12-01T07:59:00.000Z',
      season_start_date: '2026-12-01',
      season_end_date: '2027-05-31',
      status: 'draft',
      public_registration_enabled: 0,
    });

    const audit = await client.execute(`
      SELECT admin_user_id, reason, before_snapshot, after_snapshot
      FROM club_season_admin_audit_log
      WHERE action = 'season_dates_configured'
    `);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].admin_user_id, 'admin-dates');
    assert.deepEqual(JSON.parse(String(audit.rows[0].before_snapshot)), {
      seasonStartDate: null,
      seasonEndDate: null,
    });
    assert.deepEqual(JSON.parse(String(audit.rows[0].after_snapshot)), {
      seasonStartDate: '2026-12-01',
      seasonEndDate: '2027-05-31',
      standardOfferResponseDays: 3,
    });
  } finally {
    await client.close();
  }
});

test('approved production dates refuse a conflicting existing season end', async () => {
  const client = await createProductionShapedDatabase('conflict');
  try {
    await client.execute(`
      UPDATE club_seasons SET season_start_date = '2026-12-01', season_end_date = '2027-05-02'
      WHERE id = '2026-2027-club'
    `);
    const script = await fs.readFile(
      path.join(root, 'scripts/configure-production-club-season-dates.sql'),
      'utf8'
    );
    await assert.rejects(client.executeMultiple(script));
    const season = await client.execute(`
      SELECT season_start_date, season_end_date FROM club_seasons WHERE id = '2026-2027-club'
    `);
    assert.deepEqual(season.rows[0], {
      season_start_date: '2026-12-01',
      season_end_date: '2027-05-02',
    });
  } finally {
    await client.close();
  }
});
