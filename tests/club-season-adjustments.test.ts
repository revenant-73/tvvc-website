import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/index.ts';
import { clubSeasonFinancialAdjustments, clubSeasonPaymentPlans } from '../src/db/schema.ts';
import {
  recordClubSeasonAdjustment,
  refundClubSeasonPayment,
  reverseClubSeasonAdjustment,
} from '../src/lib/club-season-adjustments.ts';
import { getClubSeasonLedgerState, summarizeClubSeasonLedger } from '../src/lib/club-season-ledger.ts';

const databasePath = path.join(process.cwd(), 'test-results', 'club-season-adjustments.db');
const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;
const uuid = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

async function removeDatabase() {
  const options = { force: true, maxRetries: 5, retryDelay: 50 };
  await fs.rm(databasePath, options); await fs.rm(`${databasePath}-shm`, options); await fs.rm(`${databasePath}-wal`, options);
}

test('ledger summary separates cash, refunds, credits, write-offs, and reversals', () => {
  const summary = summarizeClubSeasonLedger(150000, [{ id: 'txn', amount: 40000, status: 'succeeded' }], [
    { id: 'offline', type: 'offline_payment', amount: 10000, balanceEffect: -10000 },
    { id: 'credit', type: 'credit', amount: 5000, balanceEffect: -5000 },
    { id: 'credit-reversal', type: 'reversal', amount: 5000, balanceEffect: 5000, reversesAdjustmentId: 'credit' },
    { id: 'write-off', type: 'write_off', amount: 3000, balanceEffect: -3000 },
    { id: 'refund', type: 'stripe_refund', amount: 12000, balanceEffect: 12000, transactionId: 'txn' },
  ]);
  assert.deepEqual(summary, {
    stripePaidAmount: 40000, offlinePaidAmount: 10000, creditAmount: 0,
    writeOffAmount: 3000, refundedAmount: 12000, netCollectedAmount: 38000,
    remainingBalance: 109000,
  });
});

test('manual entries, counter-entries, and Stripe refunds remain immutable and reconcile the balance', async () => {
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
      { sql: `INSERT INTO user (id,name,email,role) VALUES ('admin','TVVC Admin','admin@tvvc.test','admin'),('parent','Pat Parent','parent@tvvc.test','user')`, args: [] },
      { sql: `INSERT INTO registrations (id,user_id,parent_name,parent_email,parent_phone,status,total_amount) VALUES ('tryout','parent','Pat Parent','parent@tvvc.test','503-555-0100','paid',5000)`, args: [] },
      { sql: `INSERT INTO athletes (id,registration_id,parent_id,first_name,last_name,grade) VALUES (902,'tryout','parent','Alex','Account','8')`, args: [] },
      { sql: `INSERT INTO club_teams (id,season_id,age_group_id,name) VALUES ('team-adjust','2026-2027-club','age-2026-2027-14u','14 Black')`, args: [] },
      { sql: `INSERT INTO club_season_offers (id,season_id,team_id,source_registration_id,source_athlete_id,recipient_email,recipient_user_id,status) VALUES ('offer-adjust','2026-2027-club','team-adjust','tryout',902,'parent@tvvc.test','parent','accepted')`, args: [] },
      { sql: `INSERT INTO club_season_registrations (id,offer_id,season_id,team_id,owner_user_id,status,current_step) VALUES ('reg-adjust','offer-adjust','2026-2027-club','team-adjust','parent','active',4)`, args: [] },
      { sql: `INSERT INTO club_season_payment_plans (id,registration_id,owner_user_id,status,financial_status,current_version,stripe_customer_id,stripe_payment_method_id) VALUES ('plan-adjust','reg-adjust','parent','active','current',1,'cus_test','pm_test')`, args: [] },
      { sql: `INSERT INTO club_season_payment_plan_versions (id,payment_plan_id,version,payment_option,status,total_amount,due_now_amount,currency,billing_day,schedule_snapshot,terms_fingerprint) VALUES ('version-adjust','plan-adjust',1,'standard_plan','active',150000,40000,'usd',5,'{}',?)`, args: ['a'.repeat(64)] },
      { sql: `INSERT INTO club_season_payment_installments (id,payment_plan_version_id,sequence,type,due_date,amount,status,paid_at,stripe_payment_intent_id) VALUES ('deposit-adjust','version-adjust',0,'deposit','2026-11-10',40000,'paid',CURRENT_TIMESTAMP,'pi_deposit'),('future-adjust-1','version-adjust',1,'installment','2027-01-05',55000,'scheduled',NULL,NULL),('future-adjust-2','version-adjust',2,'installment','2027-02-05',55000,'scheduled',NULL,NULL)`, args: [] },
      { sql: `INSERT INTO club_season_payment_transactions (id,registration_id,payment_plan_version_id,installment_id,stripe_event_id,source,stripe_checkout_session_id,stripe_payment_intent_id,amount,currency,status,processed_at) VALUES ('txn-adjust','reg-adjust','version-adjust','deposit-adjust','evt_adjust','checkout','cs_adjust','pi_deposit',40000,'usd','succeeded',CURRENT_TIMESTAMP)`, args: [] },
    ], 'write');
    const db = getDb(databaseUrl);
    const offline = await recordClubSeasonAdjustment(db, {
      requestId: uuid('1'), registrationId: 'reg-adjust', type: 'offline_payment', amount: 10000,
      effectiveDate: '2026-12-01', reason: 'Check received at practice', today: '2026-12-01', adminUserId: 'admin',
    });
    await recordClubSeasonAdjustment(db, {
      requestId: uuid('2'), registrationId: 'reg-adjust', type: 'credit', amount: 5000,
      effectiveDate: '2026-12-01', reason: 'Approved volunteer credit', today: '2026-12-01', adminUserId: 'admin',
    });
    let ledger = await getClubSeasonLedgerState(db, 'reg-adjust', 150000);
    assert.equal(ledger.summary.remainingBalance, 95000);
    assert.equal(ledger.summary.netCollectedAmount, 50000);

    await reverseClubSeasonAdjustment(db, {
      requestId: uuid('3'), adjustmentId: uuid('2'), reason: 'Credit entered on wrong family',
      today: '2026-12-02', adminUserId: 'admin',
    });
    ledger = await getClubSeasonLedgerState(db, 'reg-adjust', 150000);
    assert.equal(ledger.summary.remainingBalance, 100000);
    assert.equal(offline.remainingBalance, 100000);

    const refundCalls: any[] = [];
    const stripe = { refunds: { create: async (params: any, options: any) => {
      refundCalls.push({ params, options });
      return { id: 're_test_adjust', amount: params.amount, status: 'succeeded' };
    } } } as any;
    await refundClubSeasonPayment(db, stripe, {
      requestId: uuid('4'), transactionId: 'txn-adjust', amount: 15000,
      reason: 'Case-by-case partial refund approved', today: '2026-12-03', adminUserId: 'admin',
    });
    ledger = await getClubSeasonLedgerState(db, 'reg-adjust', 150000);
    assert.equal(ledger.summary.refundedAmount, 15000);
    assert.equal(ledger.summary.remainingBalance, 115000);
    assert.equal(refundCalls[0].options.idempotencyKey, `club-season-refund:${uuid('4')}`);
    const [plan] = await db.select().from(clubSeasonPaymentPlans).where(eq(clubSeasonPaymentPlans.id, 'plan-adjust'));
    assert.equal(plan.financialStatus, 'action_required');
    assert.equal(plan.needsReview, true);

    await assert.rejects(recordClubSeasonAdjustment(db, {
      requestId: uuid('5'), registrationId: 'reg-adjust', type: 'credit', amount: 120000,
      effectiveDate: '2026-12-03', reason: 'Too large', today: '2026-12-03', adminUserId: 'admin',
    }), /ADJUSTMENT_EXCEEDS_BALANCE/);

    const entries = await db.select().from(clubSeasonFinancialAdjustments);
    assert.equal(entries.length, 4);
    await assert.rejects(client.execute({ sql: `UPDATE club_season_financial_adjustments SET reason='rewritten' WHERE id=?`, args: [uuid('1')] }), /immutable/i);
    await assert.rejects(client.execute({ sql: `DELETE FROM club_season_financial_adjustments WHERE id=?`, args: [uuid('1')] }), /cannot be deleted/i);
  } finally {
    client.close(); await removeDatabase().catch(() => {});
  }
});
