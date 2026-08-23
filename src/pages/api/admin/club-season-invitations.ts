import type { APIRoute } from 'astro';
import { requireAdminApiSession } from '../../../lib/admin-auth';
import { rejectCrossOriginRequest } from '../../../lib/request-security';
import {
  invitationActionSchema,
  invitationHistory,
  previewInvitation,
  releaseInvitations,
  resendSentInvitations,
  retryFailedInvitations,
  sendInvitationBatch,
  testSendInvitation,
} from '../../../lib/club-season-invitations';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireAdminApiSession(request);
  if (auth.authorized === false) return auth.response;
  const parsed = invitationActionSchema.safeParse({ action: 'history', seasonId: url.searchParams.get('seasonId'), wave: url.searchParams.get('wave') });
  if (!parsed.success || parsed.data.action !== 'history') return json({ error: parsed.success ? 'Invalid history request.' : parsed.error.issues[0]?.message }, 400);
  try {
    return json(await invitationHistory(auth.db, parsed.data.seasonId, parsed.data.wave));
  } catch (error) {
    console.error('Club season invitation history failed:', error);
    return json({ error: 'Invitation history could not be loaded.' }, 500);
  }
};

export const POST: APIRoute = async ({ request, url }) => {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;
  const auth = await requireAdminApiSession(request);
  if (auth.authorized === false) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'A valid JSON request is required.' }, 400); }
  const parsed = invitationActionSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || 'Invalid invitation action.' }, 400);
  try {
    const origin = url.origin;
    switch (parsed.data.action) {
      case 'preview': return json(await previewInvitation(auth.db, parsed.data.offerId, origin));
      case 'test_send': return json(await testSendInvitation(auth.db, auth.user, { ...parsed.data, siteOrigin: origin }));
      case 'release': return json(await releaseInvitations(auth.db, auth.user, { ...parsed.data, siteOrigin: origin }));
      case 'send_batch': return json(await sendInvitationBatch(auth.db, auth.user, parsed.data.batchId));
      case 'retry_failed': return json(await retryFailedInvitations(auth.db, auth.user, parsed.data.batchId));
      case 'resend_sent': return json(await resendSentInvitations(auth.db, auth.user, parsed.data.batchId, parsed.data.itemIds, parsed.data.reason));
      case 'history': return json(await invitationHistory(auth.db, parsed.data.seasonId, parsed.data.wave));
    }
  } catch (error) {
    console.error('Club season invitation action failed:', error);
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 500;
    return json({ error: status === 500 ? 'Unable to complete the invitation action.' : (error as Error).message }, status);
  }
};
