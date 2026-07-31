import type { getDb } from '../db';
import { registrations, events, registrationItems } from '../db/schema';
import { and, eq, sql } from 'drizzle-orm';

type ReservationStore = Pick<ReturnType<typeof getDb>, 'select' | 'update'>;

export async function expirePendingRegistration(
  store: ReservationStore,
  registrationId: string,
  stripeSessionId?: string
) {
  const conditions = [
    eq(registrations.id, registrationId),
    eq(registrations.status, 'pending'),
  ];

  if (stripeSessionId) {
    conditions.push(eq(registrations.stripeSessionId, stripeSessionId));
  }

  // The status transition is the idempotency boundary. Only the caller that
  // moves this registration out of pending may release its reservations.
  const [expiredRegistration] = await store.update(registrations)
    .set({ status: 'expired' })
    .where(and(...conditions))
    .returning({ id: registrations.id });

  if (!expiredRegistration) {
    return { expired: false, spotsReleased: 0 };
  }

  const items = await store.select({ eventId: registrationItems.eventId })
    .from(registrationItems)
    .where(eq(registrationItems.registrationId, registrationId));
  const releasedSpotsByEvent = new Map<string, number>();

  for (const item of items) {
    if (!item.eventId) continue;
    releasedSpotsByEvent.set(
      item.eventId,
      (releasedSpotsByEvent.get(item.eventId) || 0) + 1
    );
  }

  for (const [eventId, spotsToRelease] of releasedSpotsByEvent) {
    await store.update(events)
      .set({
        pendingSpots: sql`MAX(0, COALESCE(${events.pendingSpots}, 0) - ${spotsToRelease})`,
      })
      .where(eq(events.id, eventId));
  }

  return { expired: true, spotsReleased: items.length };
}
