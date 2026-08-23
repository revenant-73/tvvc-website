import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  clubSeasonInvitationDeliveryAttempts,
  clubSeasonInvitationDeliveryEvents,
} from '../db/schema.ts';

type Database = any;

export const resendInvitationWebhookSchema = z.object({
  type: z.string().trim().min(1),
  created_at: z.string().trim().min(1),
  data: z.object({
    email_id: z.string().trim().min(1),
    to: z.array(z.string()).optional(),
    subject: z.string().optional(),
    bounce: z.unknown().optional(),
    failed: z.unknown().optional(),
    tags: z.record(z.string(), z.string()).optional(),
  }).passthrough(),
}).passthrough();

type ResendInvitationWebhookEvent = z.infer<typeof resendInvitationWebhookSchema>;

const trackedInvitationEventTypes = new Set([
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.failed',
  'email.bounced',
  'email.complained',
  'email.suppressed',
]);

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function stringifyReason(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return [record.message, record.reason, record.type, record.subType]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' · ') || null;
}

function eventSummary(event: ResendInvitationWebhookEvent) {
  if (event.type === 'email.delivered') return { severity: 'info', reason: 'Delivered to the recipient mail server.' };
  if (event.type === 'email.sent') return { severity: 'info', reason: 'Accepted by Resend for delivery.' };
  if (event.type === 'email.delivery_delayed') return { severity: 'warning', reason: 'Delivery is temporarily delayed.' };
  if (event.type === 'email.failed') return { severity: 'error', reason: stringifyReason(event.data.failed) || 'Resend reported a send failure.' };
  if (event.type === 'email.bounced') return { severity: 'error', reason: stringifyReason(event.data.bounce) || 'Recipient mail server rejected the message.' };
  if (event.type === 'email.complained') return { severity: 'error', reason: 'Recipient marked this message as spam.' };
  if (event.type === 'email.suppressed') return { severity: 'error', reason: 'Message was suppressed by Resend.' };
  return { severity: 'info', reason: null };
}

export async function recordResendInvitationWebhookEvent(
  db: Database,
  eventInput: unknown,
  webhookMessageId: string
) {
  const event = resendInvitationWebhookSchema.parse(eventInput);
  if (!trackedInvitationEventTypes.has(event.type)) return { processed: false, ignored: true, reason: 'untracked_event_type' };

  const [attempt] = await db.select().from(clubSeasonInvitationDeliveryAttempts)
    .where(eq(clubSeasonInvitationDeliveryAttempts.providerMessageId, event.data.email_id))
    .limit(1);
  if (!attempt) return { processed: false, ignored: true, reason: 'unmatched_provider_message' };

  const summary = eventSummary(event);
  const [inserted] = await db.insert(clubSeasonInvitationDeliveryEvents).values({
    id: crypto.randomUUID(),
    attemptId: attempt.id,
    batchId: attempt.batchId,
    batchItemId: attempt.batchItemId,
    providerMessageId: event.data.email_id,
    webhookMessageId,
    eventType: event.type,
    eventCreatedAt: event.created_at,
    recipientEmail: normalizeEmail(event.data.to?.[0]),
    severity: summary.severity,
    reason: summary.reason,
    payload: JSON.stringify(event),
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing().returning({ id: clubSeasonInvitationDeliveryEvents.id });

  return {
    processed: Boolean(inserted),
    duplicate: !inserted,
    ignored: false,
    attemptId: attempt.id,
    batchId: attempt.batchId,
    eventType: event.type,
    severity: summary.severity,
  };
}
