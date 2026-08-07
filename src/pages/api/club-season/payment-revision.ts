import type { APIRoute } from 'astro';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/db';
import { clubSeasonPaymentInstallments, clubSeasonPaymentPlanRevisions, clubSeasonPaymentPlanVersions } from '../../../db/schema';
import { getOwnedClubSeasonOffers, getVerifiedClubSeasonUser } from '../../../lib/club-season-access';
import { deliverClubSeasonEmail } from '../../../lib/club-season-billing';
import { getClubSeasonFinancialAccount, reviewClubSeasonPlanRevision } from '../../../lib/club-season-financials';
import { paymentPlanRevisionAcceptedEmail } from '../../../lib/club-season-payment-emails';
import { parentPlanRevisionSchema, revisionAuthorizationText } from '../../../lib/club-season-plan-revision';
import { isClubSeasonRegistrationEnabled } from '../../../lib/club-season-feature';
import { rejectCrossOriginRequest } from '../../../lib/request-security';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function requestIpHash(request: Request): Promise<string | null> {
  const forwarded = request.headers.get('x-nf-client-connection-ip')?.trim() || '';
  const secret = import.meta.env.AUTH_SECRET || process.env.AUTH_SECRET || '';
  if (!forwarded || !secret) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(forwarded));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function ownedRegistrationIds(request: Request) {
  return (await getOwnedClubSeasonOffers(request)).flatMap((item) => item.draft ? [item.draft.id] : []);
}

export const GET: APIRoute = async ({ request }) => {
  if (!isClubSeasonRegistrationEnabled()) return json({ error: 'Not found.' }, 404);
  if (!db) return json({ error: 'Database configuration missing.' }, 500);
  const user = await getVerifiedClubSeasonUser(request);
  if (!user) return json({ error: 'Authentication required.' }, 401);
  const registrationIds = await ownedRegistrationIds(request);
  const revisions = registrationIds.length ? await db.select({
    revision: clubSeasonPaymentPlanRevisions,
    version: clubSeasonPaymentPlanVersions,
  }).from(clubSeasonPaymentPlanRevisions)
    .innerJoin(clubSeasonPaymentPlanVersions, eq(clubSeasonPaymentPlanRevisions.proposedVersionId, clubSeasonPaymentPlanVersions.id))
    .where(and(
      eq(clubSeasonPaymentPlanRevisions.status, 'pending_authorization'),
      inArray(clubSeasonPaymentPlanRevisions.registrationId, registrationIds)
    )) : [];
  const items = await Promise.all(revisions.map(async (row) => {
    const installments = await db.select().from(clubSeasonPaymentInstallments)
      .where(eq(clubSeasonPaymentInstallments.paymentPlanVersionId, row.version.id))
      .orderBy(clubSeasonPaymentInstallments.dueDate);
    const snapshot = JSON.parse(row.version.scheduleSnapshot);
    return {
      id: row.revision.id, registrationId: row.revision.registrationId, reason: row.revision.reason,
      proposedAt: row.revision.proposedAt, termsFingerprint: row.version.termsFingerprint,
      remainingBalance: snapshot.remainingBalance, authorizationText: revisionAuthorizationText(snapshot.charges, snapshot.remainingBalance),
      installments: installments.map((item) => ({ id: item.id, dueDate: item.dueDate, amount: item.amount })),
    };
  }));
  return json({ revisions: items });
};

export const POST: APIRoute = async ({ request }) => {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;
  if (!isClubSeasonRegistrationEnabled()) return json({ error: 'Not found.' }, 404);
  if (!db) return json({ error: 'Database configuration missing.' }, 500);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const parsed = parentPlanRevisionSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || 'Invalid response.' }, 400);
  const user = await getVerifiedClubSeasonUser(request);
  if (!user) return json({ error: 'Authentication required.' }, 401);
  const registrationIds = await ownedRegistrationIds(request);
  const [revision] = await db.select().from(clubSeasonPaymentPlanRevisions).where(eq(clubSeasonPaymentPlanRevisions.id, parsed.data.revisionId)).limit(1);
  if (!revision || !registrationIds.includes(revision.registrationId)) return json({ error: 'Revision not found.' }, 404);
  try {
    const result = await reviewClubSeasonPlanRevision(db, {
      revisionId: revision.id, ownerUserId: user.id, ownerEmail: user.email, action: parsed.data.action,
      authorizedName: parsed.data.action === 'authorize' ? parsed.data.authorizedName : undefined,
      termsFingerprint: parsed.data.action === 'authorize' ? parsed.data.termsFingerprint : undefined,
      requestIpHash: parsed.data.action === 'authorize' ? await requestIpHash(request) : null,
      userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
    });
    if (result.status === 'accepted') {
      const account = await getClubSeasonFinancialAccount(db, revision.registrationId);
      if (account) {
        const message = paymentPlanRevisionAcceptedEmail({
          parentName: account.parentName, playerName: account.playerName, teamName: account.teamName,
          amount: 0, dueDate: '', remainingBalance: account.remainingBalance,
          portalUrl: `${new URL(request.url).origin}/portal/dashboard`,
        });
        try {
          await deliverClubSeasonEmail(db, { registrationId: account.registrationId, type: 'plan_revision_accepted',
            recipient: account.parentEmail, key: `club-season-revision-accepted:${revision.id}`, ...message });
        } catch (error) { console.error('Revision acceptance email failed:', error); }
      }
    }
    return json({ revision: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const messages: Record<string, string> = {
      REVISION_NOT_PENDING: 'This revision is no longer awaiting your response.',
      REVISION_STALE: 'The payment plan changed. Ask TVVC to prepare a fresh revision.',
      TERMS_CHANGED: 'The schedule changed. Reload and review it again.',
      PAYMENT_PROCESSING: 'A payment is currently processing. Try again after it resolves.',
      PAYMENT_ATTEMPT_UNRESOLVED: 'A prior payment attempt still needs TVVC review before this revision can be activated.',
      BALANCE_CHANGED: 'The balance changed after this schedule was proposed. Ask TVVC for an updated revision.',
    };
    if (!messages[code]) console.error('Review plan revision error:', error);
    return json({ error: messages[code] || 'Unable to record your response.', code }, messages[code] ? 409 : 500);
  }
};
