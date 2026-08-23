import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { getDb } from '../../../db';
import { recordResendInvitationWebhookEvent } from '../../../lib/club-season-resend-webhooks';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const payload = await request.text();
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  const webhookSecret = import.meta.env.RESEND_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET;

  if (!id || !timestamp || !signature) return json({ error: 'Missing webhook signature headers.' }, 400);
  if (!webhookSecret) return json({ error: 'Resend webhook secret is not configured.' }, 500);

  let event: unknown;
  try {
    const resend = new Resend(import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY || 're_webhook_verify_only');
    event = (resend.webhooks.verify as any)({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
  } catch (error) {
    console.error('Resend webhook verification failed:', error);
    return json({ error: 'Invalid webhook signature.' }, 400);
  }

  const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
  if (!databaseUrl) return json({ error: 'Database configuration missing.' }, 500);

  try {
    const db = getDb(databaseUrl, import.meta.env.TURSO_AUTH_TOKEN || '');
    const result = await recordResendInvitationWebhookEvent(db, event, id);
    return json({ received: true, ...result });
  } catch (error) {
    console.error('Resend webhook processing failed:', error);
    return json({ error: 'Resend webhook could not be processed.' }, 500);
  }
};
