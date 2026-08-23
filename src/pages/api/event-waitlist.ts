import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { events, eventWaitlistEntries, playerProfiles } from '../../db/schema';
import { getClubDate, isRegistrationEventEligible } from '../../lib/event-eligibility';
import { ensureCanonicalPortalUser } from '../../lib/portal-ownership';
import { rejectCrossOriginRequest } from '../../lib/request-security';
import { registrationSchema } from '../../lib/schemas';

export const prerender = false;

class WaitlistUnavailableError extends Error {}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const originError = rejectCrossOriginRequest(request);
    if (originError) return originError;

    const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
    if (!databaseUrl) {
      return new Response(JSON.stringify({ error: 'Database configuration missing' }), { status: 500 });
    }

    const session = await getSession(request).catch(() => null);
    const portalUser = session ? await ensureCanonicalPortalUser(session.user) : null;
    const userId = portalUser?.id || null;

    const body = await request.json();
    const validation = registrationSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      }), { status: 400 });
    }

    const { parentInfo, athletes: athleteData } = validation.data;
    const requestedEventIds = [...new Set(athleteData.flatMap((athlete) => athlete.selectedEvents))];
    if (!requestedEventIds.length) {
      return new Response(JSON.stringify({ error: 'Select at least one waitlist event.' }), { status: 400 });
    }

    const db = getDb(databaseUrl, import.meta.env.TURSO_AUTH_TOKEN || '');
    const parentEmail = normalizedEmail(parentInfo.email);
    const clubDate = getClubDate();
    const now = new Date().toISOString();

    const entries = await db.transaction(async (tx) => {
      const selectedEvents = await tx.select().from(events).where(inArray(events.id, requestedEventIds));
      const eventById = new Map(selectedEvents.map((event) => [event.id, event]));

      for (const eventId of requestedEventIds) {
        const event = eventById.get(eventId);
        const reserved = (event?.spotsFilled || 0) + (event?.pendingSpots || 0);
        if (
          !event ||
          !isRegistrationEventEligible(event, clubDate) ||
          !event.waitlistEnabled ||
          reserved < event.capacity
        ) {
          throw new WaitlistUnavailableError('One or more selected events is not currently accepting waitlist entries.');
        }
      }

      const created: Array<{ id: string; eventId: string; status: string }> = [];

      for (const athlete of athleteData) {
        let profileId = athlete.profileId || null;
        if (profileId) {
          if (!userId) throw new WaitlistUnavailableError('Sign in to use a saved player profile.');
          const [ownedProfile] = await tx.select({ id: playerProfiles.id })
            .from(playerProfiles)
            .where(and(
              eq(playerProfiles.id, profileId),
              eq(playerProfiles.parentId, userId),
              isNull(playerProfiles.archivedAt),
              isNull(playerProfiles.mergedIntoProfileId)
            ))
            .limit(1);
          if (!ownedProfile) throw new WaitlistUnavailableError('Saved player profile not found.');
          profileId = ownedProfile.id;
        }

        for (const eventId of athlete.selectedEvents) {
          const entryId = crypto.randomUUID();
          await tx.insert(eventWaitlistEntries).values({
            id: entryId,
            eventId,
            userId,
            profileId,
            parentName: parentInfo.name.trim(),
            parentEmail,
            parentPhone: parentInfo.phone.trim(),
            secondaryParentName: parentInfo.secondaryParentName || null,
            secondaryParentEmail: parentInfo.secondaryParentEmail || null,
            secondaryParentPhone: parentInfo.secondaryParentPhone || null,
            emergencyPhone: parentInfo.emergencyPhone,
            athleteFirstName: athlete.firstName.trim(),
            athleteLastName: athlete.lastName.trim(),
            athletePreferredName: athlete.preferredName || null,
            athleteGrade: athlete.grade,
            athleteMedicalInfo: athlete.medicalInfo || null,
            status: 'waitlisted',
            source: 'public',
            createdAt: now,
            updatedAt: now,
          }).onConflictDoNothing();

          const [entry] = await tx.select({
            id: eventWaitlistEntries.id,
            status: eventWaitlistEntries.status,
          })
            .from(eventWaitlistEntries)
            .where(and(
              eq(eventWaitlistEntries.eventId, eventId),
              eq(eventWaitlistEntries.parentEmail, parentEmail),
              eq(eventWaitlistEntries.athleteFirstName, athlete.firstName.trim()),
              eq(eventWaitlistEntries.athleteLastName, athlete.lastName.trim()),
              sql`${eventWaitlistEntries.status} IN ('waitlisted', 'invited')`
            ))
            .limit(1);

          if (entry) created.push({ id: entry.id, eventId, status: entry.status });
        }
      }

      return created;
    });

    return new Response(JSON.stringify({
      success: true,
      entries,
      message: 'Waitlist request saved.',
    }), { status: 200 });
  } catch (error) {
    if (error instanceof WaitlistUnavailableError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 409 });
    }

    console.error('Event waitlist API error:', error);
    return new Response(JSON.stringify({ error: 'Unable to save waitlist request.' }), { status: 500 });
  }
};
