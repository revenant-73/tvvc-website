import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import {
  auditProductionSchema,
  deleteOrphanedManualRegistration,
  repairProductionSchema,
} from '../src/lib/production-schema-repair.ts';

async function removeDatabase(databasePath: string) {
  await fs.rm(databasePath, { force: true });
  await fs.rm(`${databasePath}-shm`, { force: true });
  await fs.rm(`${databasePath}-wal`, { force: true });
}

async function applyInitialMigration(client: ReturnType<typeof createClient>) {
  const sql = (await fs.readFile(
    path.join(process.cwd(), 'drizzle', '0000_thin_terrax.sql'),
    'utf8'
  )).replaceAll('--> statement-breakpoint', '');
  await client.executeMultiple(sql);
}

test('repairs the production schema idempotently and preserves the pre-migration athlete snapshot', async () => {
  const databasePath = path.join(process.cwd(), 'test-results', 'production-schema-repair.db');
  const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await removeDatabase(databasePath);

  const client = createClient({ url: databaseUrl });
  try {
    await applyInitialMigration(client);
    await client.batch([
      {
        sql: `INSERT INTO user (id, email, email_verified)
              VALUES ('repair-parent', 'repair@tvvc.test', ?)`,
        args: [Date.now()],
      },
      {
        sql: `INSERT INTO registrations
              (id, user_id, parent_name, parent_email, parent_phone, total_amount)
              VALUES ('repair-order', 'repair-parent', 'Repair Parent',
                      'repair@tvvc.test', '503-555-0100', 0)`,
        args: [],
      },
      {
        sql: `INSERT INTO athletes
              (id, registration_id, parent_id, first_name, last_name, grade, medical_info)
              VALUES (81, 'repair-order', 'repair-parent', 'Schema', 'Player', '9th', 'Snapshot')`,
        args: [],
      },
    ], 'write');

    const before = await auditProductionSchema(client);
    assert.deepEqual(before.missingSteps, [
      'create player_profiles',
      'add athletes.profile_id',
      'add player_profiles.archived_at',
      'add player_profiles.merged_into_profile_id',
      'create household_guardians',
    ]);

    const firstRepair = await repairProductionSchema(client);
    assert.deepEqual(firstRepair.after.missingSteps, []);

    const profile = await client.execute(
      'SELECT id, parent_id, grade, medical_info FROM player_profiles WHERE id = 81'
    );
    const athlete = await client.execute(
      'SELECT profile_id, grade, medical_info FROM athletes WHERE id = 81'
    );
    const backup = await client.execute(
      'SELECT id, grade, medical_info FROM codex_backup_20260731_athletes_before_profile_migration WHERE id = 81'
    );
    assert.deepEqual(profile.rows[0], {
      id: 81,
      parent_id: 'repair-parent',
      grade: '9th',
      medical_info: 'Snapshot',
    });
    assert.deepEqual(athlete.rows[0], {
      profile_id: 81,
      grade: '9th',
      medical_info: 'Snapshot',
    });
    assert.deepEqual(backup.rows[0], {
      id: 81,
      grade: '9th',
      medical_info: 'Snapshot',
    });

    const secondRepair = await repairProductionSchema(client);
    assert.deepEqual(secondRepair.after.missingSteps, []);
    assert.equal(
      (await client.execute('SELECT COUNT(*) AS count FROM player_profiles')).rows[0]?.count,
      1
    );
    assert.equal(
      (await client.execute('SELECT COUNT(*) AS count FROM codex_backup_20260731_athletes_before_profile_migration')).rows[0]?.count,
      1
    );
  } finally {
    client.close();
    await removeDatabase(databasePath).catch(() => {});
  }
});

test('backs up and deletes only a paid manual registration with no dependent rows', async () => {
  const databasePath = path.join(process.cwd(), 'test-results', 'production-orphan-cleanup.db');
  const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await removeDatabase(databasePath);

  const client = createClient({ url: databaseUrl });
  try {
    await applyInitialMigration(client);
    const orphanId = 'manual_48aa9bf1-bcf6-462f-828f-57ece7a4699b';
    await client.execute({
      sql: `INSERT INTO registrations
            (id, parent_name, parent_email, parent_phone, status, total_amount)
            VALUES (?, 'Repair Parent', 'repair@tvvc.test', '503-555-0100', 'paid', 0)`,
      args: [orphanId],
    });

    assert.equal(await deleteOrphanedManualRegistration(client, 'not-a-manual-id'), false);
    assert.equal(await deleteOrphanedManualRegistration(client, orphanId), true);
    assert.equal(
      (await client.execute({
        sql: 'SELECT COUNT(*) AS count FROM registrations WHERE id = ?',
        args: [orphanId],
      })).rows[0]?.count,
      0
    );
    assert.equal(
      (await client.execute({
        sql: 'SELECT COUNT(*) AS count FROM codex_backup_20260731_orphaned_manual_registrations WHERE id = ?',
        args: [orphanId],
      })).rows[0]?.count,
      1
    );
    assert.equal(await deleteOrphanedManualRegistration(client, orphanId), false);
  } finally {
    client.close();
    await removeDatabase(databasePath).catch(() => {});
  }
});
