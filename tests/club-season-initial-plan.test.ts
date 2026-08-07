import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/index.ts';
import { clubSeasonPaymentInstallments, clubSeasonPaymentPlans, clubSeasonPaymentPlanVersions } from '../src/db/schema.ts';
import {
  cancelInitialCustomPlan,
  getInitialPlanCandidates,
  initialPlanAuthorizationText,
  initialPlanTermsFromSnapshot,
  normalizeInitialCustomCharges,
  proposeInitialCustomPlan,
  type InitialCustomPlanSnapshot,
} from '../src/lib/club-season-initial-plan.ts';
import { hashClubSeasonPaymentTerms } from '../src/lib/club-season-payment.ts';

const databasePath = path.join(process.cwd(), 'test-results', 'club-season-initial-plan.db');
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;

async function removeDatabase() {
  const options = { force: true, maxRetries: 5, retryDelay: 50 };
  await fs.rm(databasePath, options); await fs.rm(`${databasePath}-shm`, options); await fs.rm(`${databasePath}-wal`, options);
}

test('custom initial plan reconciles due-now and future charges to the season total', async () => {
  const charges = normalizeInitialCustomCharges([
    { dueDate: '2027-01-05', amount: 25000 },
    { dueDate: '2027-02-05', amount: 25000 },
    { dueDate: '2027-03-05', amount: 25000 },
    { dueDate: '2027-04-05', amount: 25000 },
    { dueDate: '2027-05-05', amount: 20000 },
  ], '2026-11-12', 150000, 30000);
  const snapshot: InitialCustomPlanSnapshot = {
    kind: 'initial_custom_plan', currency: 'usd', seasonTotal: 150000,
    dueNowAmount: 30000, proposedOn: '2026-11-12', reason: 'Family arrangement',
    adminNote: null, charges,
  };
  const terms = initialPlanTermsFromSnapshot(snapshot);

  assert.equal(terms.paymentOption, 'custom_plan');
  assert.equal(terms.charges[0].type, 'deposit');
  assert.equal(terms.charges.reduce((sum, charge) => sum + charge.amount, 0), 150000);
  assert.match(await hashClubSeasonPaymentTerms(terms), /^[a-f0-9]{64}$/);
  assert.match(initialPlanAuthorizationText(terms), /charge \$300\.00 at checkout/);
  assert.match(initialPlanAuthorizationText(terms), /2027-05-05: \$200\.00/);
});

test('custom initial plan rejects totals, duplicate dates, and non-future charges', () => {
  assert.throws(() => normalizeInitialCustomCharges([
    { dueDate: '2027-01-05', amount: 100000 },
  ], '2026-11-12', 150000, 30000), /INITIAL_PLAN_TOTAL_MISMATCH/);
  assert.throws(() => normalizeInitialCustomCharges([
    { dueDate: '2027-01-05', amount: 60000 },
    { dueDate: '2027-01-05', amount: 60000 },
  ], '2026-11-12', 150000, 30000), /DUPLICATE_DUE_DATE/);
  assert.throws(() => normalizeInitialCustomCharges([
    { dueDate: '2026-11-12', amount: 120000 },
  ], '2026-11-12', 150000, 30000), /DUE_DATE_NOT_FUTURE/);
  assert.throws(() => normalizeInitialCustomCharges([
    { dueDate: '2027-01-05', amount: 10000 },
  ], '2026-11-12', 150000, 150000), /INVALID_DUE_NOW_AMOUNT/);
});

test('admin can propose and cancel a custom initial plan for an awaiting-payment registration', async () => {
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
      { sql: `INSERT INTO athletes (id,registration_id,parent_id,first_name,last_name,grade) VALUES (901,'tryout','parent','Taylor','Player','8')`, args: [] },
      { sql: `INSERT INTO club_teams (id,season_id,age_group_id,name) VALUES ('team-custom','2026-2027-club','age-2026-2027-14u','14 Teal')`, args: [] },
      { sql: `INSERT INTO club_season_offers (id,season_id,team_id,source_registration_id,source_athlete_id,recipient_email,recipient_user_id,status) VALUES ('offer-custom','2026-2027-club','team-custom','tryout',901,'parent@tvvc.test','parent','registration_started')`, args: [] },
      { sql: `INSERT INTO club_season_registrations (id,offer_id,season_id,team_id,owner_user_id,status,current_step) VALUES ('season-reg-custom','offer-custom','2026-2027-club','team-custom','parent','awaiting_payment',4)`, args: [] },
    ], 'write');
    const db = getDb(databaseUrl);
    const before = await getInitialPlanCandidates(db, '2026-2027-club');
    assert.equal(before.find((candidate) => candidate.registrationId === 'season-reg-custom')?.seasonTotal, 150000);
    const proposal = await proposeInitialCustomPlan(db, {
      registrationId: 'season-reg-custom', dueNowAmount: 30000,
      charges: [
        { dueDate: '2027-01-05', amount: 60000 },
        { dueDate: '2027-02-05', amount: 60000 },
      ],
      reason: 'Family requested two larger installments', today: '2026-11-12', adminUserId: 'admin',
    });
    const after = await getInitialPlanCandidates(db, '2026-2027-club');
    assert.equal(after.find((candidate) => candidate.registrationId === 'season-reg-custom')?.pendingInitialPlan?.proposalId, proposal.proposalId);
    const [plan] = await db.select().from(clubSeasonPaymentPlans).where(eq(clubSeasonPaymentPlans.registrationId, 'season-reg-custom'));
    const [version] = await db.select().from(clubSeasonPaymentPlanVersions).where(eq(clubSeasonPaymentPlanVersions.id, proposal.versionId));
    const installments = await db.select().from(clubSeasonPaymentInstallments).where(eq(clubSeasonPaymentInstallments.paymentPlanVersionId, proposal.versionId));
    assert.equal(plan.status, 'custom_pending_authorization');
    assert.equal(version.status, 'pending_authorization');
    assert.equal(installments.length, 3);
    await cancelInitialCustomPlan(db, { proposalId: proposal.proposalId, reason: 'Family changed plans', adminUserId: 'admin' });
    const [cancelledPlan] = await db.select().from(clubSeasonPaymentPlans).where(eq(clubSeasonPaymentPlans.id, plan.id));
    assert.equal(cancelledPlan.status, 'custom_cancelled');
  } finally {
    client.close(); await removeDatabase().catch(() => {});
  }
});
