import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const databasePath = path.join(process.cwd(), 'test-results', 'player-profile-migration.db');
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;

async function removeDatabase() {
  await fs.rm(databasePath, { force: true });
  await fs.rm(`${databasePath}-shm`, { force: true });
  await fs.rm(`${databasePath}-wal`, { force: true });
}

async function applyMigration(client: ReturnType<typeof createClient>, filename: string) {
  const sql = (await fs.readFile(path.join(process.cwd(), 'drizzle', filename), 'utf8'))
    .replaceAll('--> statement-breakpoint', '');
  await client.executeMultiple(sql);
}

test('backfills editable profiles without changing historical athlete snapshots', async () => {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await removeDatabase();

  const client = createClient({ url: databaseUrl });
  try {
    await applyMigration(client, '0000_thin_terrax.sql');
    await client.batch([
      {
        sql: `INSERT INTO user (id, email, email_verified)
              VALUES ('migration-parent', 'migration@tvvc.test', ?)`,
        args: [Date.now()],
      },
      {
        sql: `INSERT INTO registrations
              (id, user_id, parent_name, parent_email, parent_phone, total_amount)
              VALUES ('migration-order', 'migration-parent', 'Migration Parent',
                      'migration@tvvc.test', '503-555-0199', 5000)`,
        args: [],
      },
      {
        sql: `INSERT INTO athletes
              (id, registration_id, parent_id, first_name, last_name, grade, medical_info)
              VALUES (77, 'migration-order', 'migration-parent',
                      'Historic', 'Player', '8th', 'Original snapshot')`,
        args: [],
      },
    ], 'write');

    await applyMigration(client, '0001_player_profiles.sql');

    const profile = await client.execute(
      'SELECT id, parent_id, grade, medical_info FROM player_profiles WHERE id = 77'
    );
    const snapshot = await client.execute(
      'SELECT profile_id, grade, medical_info FROM athletes WHERE id = 77'
    );

    assert.deepEqual(profile.rows[0], {
      id: 77,
      parent_id: 'migration-parent',
      grade: '8th',
      medical_info: 'Original snapshot',
    });
    assert.deepEqual(snapshot.rows[0], {
      profile_id: 77,
      grade: '8th',
      medical_info: 'Original snapshot',
    });

    await applyMigration(client, '0002_player_profile_lifecycle.sql');

    const lifecycleColumns = await client.execute('PRAGMA table_info(player_profiles)');
    const lifecycleIndexes = await client.execute('PRAGMA index_list(player_profiles)');
    const profileAfterLifecycle = await client.execute(
      'SELECT archived_at, merged_into_profile_id FROM player_profiles WHERE id = 77'
    );

    assert.equal(
      lifecycleColumns.rows.some((column) => column.name === 'archived_at'),
      true
    );
    assert.equal(
      lifecycleColumns.rows.some((column) => column.name === 'merged_into_profile_id'),
      true
    );
    assert.equal(
      lifecycleIndexes.rows.some((index) => index.name === 'player_profiles_archived_at_idx'),
      true
    );
    assert.equal(
      lifecycleIndexes.rows.some((index) => index.name === 'player_profiles_merged_into_profile_id_idx'),
      true
    );
    assert.deepEqual(profileAfterLifecycle.rows[0], {
      archived_at: null,
      merged_into_profile_id: null,
    });

    await applyMigration(client, '0003_guardian_household_access.sql');

    const guardianColumns = await client.execute('PRAGMA table_info(household_guardians)');
    const guardianIndexes = await client.execute('PRAGMA index_list(household_guardians)');
    assert.equal(
      guardianColumns.rows.some((column) => column.name === 'owner_user_id'),
      true
    );
    assert.equal(
      guardianColumns.rows.some((column) => column.name === 'guardian_user_id'),
      true
    );
    assert.equal(
      guardianIndexes.rows.some(
        (index) => index.name === 'household_guardians_owner_email_unique'
      ),
      true
    );
  } finally {
    client.close();
    // Windows can hold the native SQLite handle briefly after close.
    await removeDatabase().catch(() => {});
  }
});
