import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminApiSession } from '../../../lib/admin-auth';
import { simulateClubSeasonBilling } from '../../../lib/club-season-billing';
import { isClubSeasonBillingSimulatorAvailable } from '../../../lib/club-season-feature';

export const prerender = false;

const requestSchema = z.object({
  registrationId: z.string().min(1),
  scenario: z.enum(['card_declined', 'authentication_required', 'payment_succeeded']),
}).strict();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireAdminApiSession(request);
  if (!auth.authorized) return auth.response;
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return json({ error: 'A same-origin browser request is required.' }, 403);
  }
  if (!isClubSeasonBillingSimulatorAvailable()) return json({ error: 'Not found.' }, 404);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Choose a valid test billing scenario.' }, 400);
  try {
    const result = await simulateClubSeasonBilling({
      db: auth.db,
      ...parsed.data,
      siteUrl: new URL(request.url).origin,
    });
    return json({ result });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'SIMULATOR_NO_ELIGIBLE_INSTALLMENT') {
      return json({ error: 'No eligible installment is available on this account. The account was not changed.' }, 409);
    }
    if (code === 'SIMULATOR_NO_RETRY_SLOT') {
      return json({ error: 'This installment has no test retry slot remaining. The account was not changed.' }, 409);
    }
    console.error('Club-season billing simulation failed:', error);
    return json({ error: 'The test billing scenario could not be completed.' }, 500);
  }
};
