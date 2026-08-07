import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/index.ts';
import {
  clubSeasonAdminAuditLog,
  clubSeasonPaymentInstallments,
  clubSeasonPaymentPlanAuthorizations,
  clubSeasonPaymentPlanRevisions,
  clubSeasonPaymentPlans,
  clubSeasonPaymentPlanVersions,
} from '../src/db/schema.ts';
import {
  getClubSeasonFinancialAccount,
  proposeClubSeasonPlanRevision,
  reviewClubSeasonPlanRevision,
} from '../src/lib/club-season-financials.ts';

const databasePath = path.join(process.cwd(), 'test-results', 'club-season-financials.db');
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;

async function removeDatabase() {
  const options = { force: true, maxRetries: 5, retryDelay: 50 };
  await fs.rm(databasePath, options); await fs.rm(`${databasePath}-shm`, options); await fs.rm(`${databasePath}-wal`, options);
}

test('proposes and parent-authorizes a reconciled revision without rewriting paid history', async () => {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await removeDatabase();
  const client = createClient({ url: databaseUrl });
  try {
    const files = (await fs.readdir(path.join(process.cwd(), 'drizzle'))).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const migration = (await fs.readFile(path.join(process.cwd(), 'drizzle', file), 'utf8')).replaceAll('--> statement-breakpoint', '');
      await client.executeMultiple(migration);
    }
    await client.batch([
      { sql: `INSERT INTO user (id,email,role) VALUES ('admin','admin@tvvc.test','admin'),('parent','parent@tvvc.test','user')`, args: [] },
      { sql: `INSERT INTO registrations (id,user_id,parent_name,parent_email,parent_phone,status,total_amount) VALUES ('tryout','parent','Pat Parent','parent@tvvc.test','503-555-0100','paid',5000)`, args: [] },
      { sql: `INSERT INTO athletes (id,registration_id,parent_id,first_name,last_name,grade) VALUES (900,'tryout','parent','Taylor','Player','8')`, args: [] },
      { sql: `INSERT INTO club_teams (id,season_id,age_group_id,name) VALUES ('team-14','2026-2027-club','age-2026-2027-14u','14 Black')`, args: [] },
      { sql: `INSERT INTO club_season_offers (id,season_id,team_id,source_registration_id,source_athlete_id,recipient_email,recipient_user_id,status) VALUES ('offer','2026-2027-club','team-14','tryout',900,'parent@tvvc.test','parent','accepted')`, args: [] },
      { sql: `INSERT INTO club_season_registrations (id,offer_id,season_id,team_id,owner_user_id,status,current_step) VALUES ('season-reg','offer','2026-2027-club','team-14','parent','active',4)`, args: [] },
      { sql: `INSERT INTO club_season_payment_plans (id,registration_id,owner_user_id,status,financial_status,current_version,stripe_customer_id,stripe_payment_method_id) VALUES ('plan','season-reg','parent','active','current',1,'cus_test','pm_test')`, args: [] },
      { sql: `INSERT INTO club_season_payment_plan_versions (id,payment_plan_id,version,payment_option,status,total_amount,due_now_amount,currency,billing_day,schedule_snapshot,terms_fingerprint) VALUES ('v1','plan',1,'standard_plan','active',150000,40000,'usd',5,'{}',?)`, args: ['a'.repeat(64)] },
      { sql: `INSERT INTO club_season_payment_installments (id,payment_plan_version_id,sequence,type,due_date,amount,status,paid_at) VALUES ('deposit','v1',0,'deposit','2026-11-10',40000,'paid',CURRENT_TIMESTAMP),('old-1','v1',1,'installment','2027-01-05',55000,'scheduled',NULL),('old-2','v1',2,'installment','2027-02-05',55000,'scheduled',NULL)`, args: [] },
      { sql: `INSERT INTO club_season_payment_transactions (id,registration_id,payment_plan_version_id,installment_id,stripe_event_id,source,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status,processed_at) VALUES ('txn','season-reg','v1','deposit','evt_deposit','checkout','cs_test','pi_deposit',40000,'usd','succeeded',CURRENT_TIMESTAMP)`, args: [] },
    ], 'write');

    const db = getDb(databaseUrl);
    const proposed = await proposeClubSeasonPlanRevision(db, {
      paymentPlanId: 'plan', reason: 'Extend the remaining balance for the family', adminUserId: 'admin', today: '2026-12-01',
      charges: [{ dueDate: '2027-03-05', amount: 55_000 }, { dueDate: '2027-04-05', amount: 55_000 }],
    });
    assert.equal(proposed.remainingBalance, 110_000);
    let account = await getClubSeasonFinancialAccount(db, 'season-reg');
    assert.equal(account?.currentVersion, 1);
    assert.equal(account?.pendingRevisionId, proposed.revisionId);

    const accepted = await reviewClubSeasonPlanRevision(db, {
      revisionId: proposed.revisionId, ownerUserId: 'parent', ownerEmail: 'parent@tvvc.test', action: 'authorize',
      authorizedName: 'Pat Parent', termsFingerprint: proposed.fingerprint,
    });
    assert.deepEqual(accepted, { status: 'accepted', version: 2 });
    account = await getClubSeasonFinancialAccount(db, 'season-reg');
    assert.equal(account?.currentVersion, 2);
    assert.equal(account?.paidAmount, 40_000);
    assert.equal(account?.remainingBalance, 110_000);

    const [plan] = await db.select().from(clubSeasonPaymentPlans).where(eq(clubSeasonPaymentPlans.id, 'plan'));
    const versions = await db.select().from(clubSeasonPaymentPlanVersions).where(eq(clubSeasonPaymentPlanVersions.paymentPlanId, 'plan'));
    const installments = await db.select().from(clubSeasonPaymentInstallments);
    const authorization = await db.select().from(clubSeasonPaymentPlanAuthorizations);
    const revision = await db.select().from(clubSeasonPaymentPlanRevisions);
    const audit = await db.select().from(clubSeasonAdminAuditLog);
    assert.equal(plan.currentVersion, 2);
    assert.equal(versions.find((version) => version.id === 'v1')?.status, 'superseded');
    assert.equal(versions.find((version) => version.version === 2)?.status, 'active');
    assert.equal(installments.find((item) => item.id === 'deposit')?.status, 'paid');
    assert.equal(installments.find((item) => item.id === 'old-1')?.status, 'superseded');
    assert.equal(installments.filter((item) => item.paymentPlanVersionId === proposed.versionId && item.status === 'scheduled').length, 2);
    assert.equal(authorization.length, 1);
    assert.equal(revision[0].status, 'accepted');
    assert.equal(audit[0].action, 'payment_plan_revision_proposed');
  } finally {
    client.close(); await removeDatabase().catch(() => {});
  }
});
