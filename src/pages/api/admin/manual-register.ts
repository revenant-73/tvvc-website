import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { registrations, athletes, registrationItems, events } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
    const ADMIN_PASSCODE = import.meta.env.ADMIN_PASSCODE || 'tvvc2024';

    if (!databaseUrl) {
      throw new Error('Database configuration missing');
    }

    const body = await request.json();
    const { passcode, athlete, eventId } = body;

    if (passcode !== ADMIN_PASSCODE) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const db = getDb(databaseUrl, import.meta.env.TURSO_AUTH_TOKEN || '');

    // 1. Create a manual registration record
    const registrationId = `manual_${uuidv4()}`;
    await db.insert(registrations).values({
      id: registrationId,
      parentName: athlete.parentName || 'Manual Entry',
      parentEmail: athlete.parentEmail || 'manual@example.com',
      parentPhone: athlete.parentPhone || '000-000-0000',
      status: 'paid', // Manual entries are considered paid
      totalAmount: 0, // Assume 0 or handled externally
    });

    // 2. Create athlete record
    const [athleteResult] = await db.insert(athletes).values({
      registrationId: registrationId,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      grade: athlete.grade,
      division: athlete.division || null,
      medicalInfo: athlete.medicalInfo || '',
      photoReleaseAgreed: true,
      waiverAgreed: true,
    }).returning({ id: athletes.id });

    if (!athleteResult) {
      throw new Error('Failed to create athlete record');
    }

    // 3. Create registration item
    await db.insert(registrationItems).values({
      registrationId,
      athleteId: athleteResult.id,
      eventId,
    });

    // 4. Increment spots filled
    await db.update(events)
      .set({ spotsFilled: sql`${events.spotsFilled} + 1` })
      .where(eq(events.id, eventId));

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error('Manual Registration Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
