import type { Client, InStatement } from '@libsql/client';

type SqlExecutor = {
  execute(statement: InStatement): Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type ManualRegistrationCandidate = {
  id: string;
  status: string | null;
  athleteCount: number;
  itemCount: number;
};

export type ProductionSchemaReport = {
  playerProfilesTable: boolean;
  athletesProfileId: boolean;
  playerProfilesArchivedAt: boolean;
  playerProfilesMergedIntoProfileId: boolean;
  householdGuardiansTable: boolean;
  missingSteps: string[];
  manualRegistrations: ManualRegistrationCandidate[];
};

async function tableExists(executor: SqlExecutor, name: string): Promise<boolean> {
  const result = await executor.execute({
    sql: 'SELECT COUNT(*) AS count FROM sqlite_master WHERE type = ? AND name = ?',
    args: ['table', name],
  });
  return Number(result.rows[0]?.count || 0) === 1;
}

async function columnNames(executor: SqlExecutor, table: string): Promise<Set<string>> {
  if (!await tableExists(executor, table)) return new Set();
  const result = await executor.execute(`PRAGMA table_info(${table})`);
  return new Set(result.rows.map((row) => String(row.name)));
}

export async function auditProductionSchema(
  executor: SqlExecutor
): Promise<ProductionSchemaReport> {
  const playerProfilesTable = await tableExists(executor, 'player_profiles');
  const athletesColumns = await columnNames(executor, 'athletes');
  const playerProfileColumns = await columnNames(executor, 'player_profiles');
  const householdGuardiansTable = await tableExists(executor, 'household_guardians');
  const manualResult = await executor.execute(`
    SELECT
      r.id,
      r.status,
      (SELECT COUNT(*) FROM athletes a WHERE a.registration_id = r.id) AS athlete_count,
      (SELECT COUNT(*) FROM registration_items i WHERE i.registration_id = r.id) AS item_count
    FROM registrations r
    WHERE r.id LIKE 'manual_%'
    ORDER BY r.created_at DESC
    LIMIT 20
  `);

  const report: ProductionSchemaReport = {
    playerProfilesTable,
    athletesProfileId: athletesColumns.has('profile_id'),
    playerProfilesArchivedAt: playerProfileColumns.has('archived_at'),
    playerProfilesMergedIntoProfileId: playerProfileColumns.has('merged_into_profile_id'),
    householdGuardiansTable,
    missingSteps: [],
    manualRegistrations: manualResult.rows.map((row) => ({
      id: String(row.id),
      status: row.status == null ? null : String(row.status),
      athleteCount: Number(row.athlete_count || 0),
      itemCount: Number(row.item_count || 0),
    })),
  };

  if (!report.playerProfilesTable) report.missingSteps.push('create player_profiles');
  if (!report.athletesProfileId) report.missingSteps.push('add athletes.profile_id');
  if (!report.playerProfilesArchivedAt) report.missingSteps.push('add player_profiles.archived_at');
  if (!report.playerProfilesMergedIntoProfileId) {
    report.missingSteps.push('add player_profiles.merged_into_profile_id');
  }
  if (!report.householdGuardiansTable) report.missingSteps.push('create household_guardians');

  return report;
}

export async function repairProductionSchema(client: Client): Promise<{
  before: ProductionSchemaReport;
  after: ProductionSchemaReport;
  backupTable: string;
}> {
  const before = await auditProductionSchema(client);
  const backupTable = 'codex_backup_20260731_athletes_before_profile_migration';

  await client.execute(`CREATE TABLE IF NOT EXISTS ${backupTable} AS SELECT * FROM athletes`);

  const tx = await client.transaction('write');
  try {
    await tx.execute(`
      CREATE TABLE IF NOT EXISTS player_profiles (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        parent_id text NOT NULL,
        first_name text NOT NULL,
        last_name text NOT NULL,
        preferred_name text,
        date_of_birth text,
        gender text,
        grade text NOT NULL,
        school text,
        grad_year text,
        division text,
        tshirt_size text,
        jersey_size text,
        experience text,
        positions text,
        medical_info text,
        metadata text,
        created_at text DEFAULT CURRENT_TIMESTAMP,
        updated_at text DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES user(id)
      )
    `);
    await tx.execute('CREATE INDEX IF NOT EXISTS player_profiles_parent_id_idx ON player_profiles(parent_id)');

    const athletesColumns = await columnNames(tx, 'athletes');
    if (!athletesColumns.has('profile_id')) {
      await tx.execute('ALTER TABLE athletes ADD profile_id integer REFERENCES player_profiles(id)');
    }

    await tx.execute(`
      INSERT OR IGNORE INTO player_profiles (
        id, parent_id, first_name, last_name, preferred_name, date_of_birth,
        gender, grade, school, grad_year, division, tshirt_size, jersey_size,
        experience, positions, medical_info, metadata
      )
      SELECT
        id, parent_id, first_name, last_name, preferred_name, date_of_birth,
        gender, grade, school, grad_year, division, tshirt_size, jersey_size,
        experience, positions, medical_info, metadata
      FROM athletes
      WHERE parent_id IS NOT NULL
    `);
    await tx.execute(`
      UPDATE athletes
      SET profile_id = id
      WHERE parent_id IS NOT NULL
        AND profile_id IS NULL
        AND EXISTS (SELECT 1 FROM player_profiles p WHERE p.id = athletes.id)
    `);
    await tx.execute('CREATE INDEX IF NOT EXISTS athletes_profile_id_idx ON athletes(profile_id)');

    const profileColumns = await columnNames(tx, 'player_profiles');
    if (!profileColumns.has('archived_at')) {
      await tx.execute('ALTER TABLE player_profiles ADD archived_at text');
    }
    if (!profileColumns.has('merged_into_profile_id')) {
      await tx.execute(
        'ALTER TABLE player_profiles ADD merged_into_profile_id integer REFERENCES player_profiles(id)'
      );
    }
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS player_profiles_archived_at_idx ON player_profiles(archived_at)'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS player_profiles_merged_into_profile_id_idx ON player_profiles(merged_into_profile_id)'
    );

    await tx.execute(`
      CREATE TABLE IF NOT EXISTS household_guardians (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        owner_user_id text NOT NULL,
        guardian_email text NOT NULL,
        guardian_user_id text,
        status text DEFAULT 'pending' NOT NULL,
        invited_at text DEFAULT CURRENT_TIMESTAMP,
        accepted_at text,
        revoked_at text,
        updated_at text DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES user(id),
        FOREIGN KEY (guardian_user_id) REFERENCES user(id)
      )
    `);
    await tx.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS household_guardians_owner_email_unique
      ON household_guardians(owner_user_id, guardian_email)
    `);
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS household_guardians_owner_user_id_idx ON household_guardians(owner_user_id)'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS household_guardians_guardian_email_idx ON household_guardians(guardian_email)'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS household_guardians_guardian_user_id_idx ON household_guardians(guardian_user_id)'
    );
    await tx.execute(
      'CREATE INDEX IF NOT EXISTS household_guardians_status_idx ON household_guardians(status)'
    );

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  const after = await auditProductionSchema(client);
  return { before, after, backupTable };
}

export async function deleteOrphanedManualRegistration(
  client: Client,
  registrationId: string
): Promise<boolean> {
  if (!/^manual_[0-9a-f-]{36}$/i.test(registrationId)) return false;

  const tx = await client.transaction('write');
  try {
    const candidate = await tx.execute({
      sql: `
        SELECT r.id
        FROM registrations r
        WHERE r.id = ?
          AND r.status = 'paid'
          AND NOT EXISTS (SELECT 1 FROM athletes a WHERE a.registration_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM registration_items i WHERE i.registration_id = r.id)
      `,
      args: [registrationId],
    });
    if (candidate.rows.length !== 1) {
      await tx.rollback();
      return false;
    }

    await tx.execute(`
      CREATE TABLE IF NOT EXISTS codex_backup_20260731_orphaned_manual_registrations
      AS SELECT * FROM registrations WHERE 0
    `);
    await tx.execute({
      sql: `
        INSERT INTO codex_backup_20260731_orphaned_manual_registrations
        SELECT * FROM registrations r
        WHERE r.id = ?
          AND NOT EXISTS (
            SELECT 1 FROM codex_backup_20260731_orphaned_manual_registrations b
            WHERE b.id = r.id
          )
      `,
      args: [registrationId],
    });
    const deletion = await tx.execute({
      sql: `
        DELETE FROM registrations
        WHERE id = ?
          AND status = 'paid'
          AND NOT EXISTS (SELECT 1 FROM athletes WHERE registration_id = ?)
          AND NOT EXISTS (SELECT 1 FROM registration_items WHERE registration_id = ?)
      `,
      args: [registrationId, registrationId, registrationId],
    });
    const deleted = Number(deletion.rowsAffected || 0) === 1;
    if (!deleted) throw new Error('Orphan registration changed during cleanup.');
    await tx.commit();
    return true;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
