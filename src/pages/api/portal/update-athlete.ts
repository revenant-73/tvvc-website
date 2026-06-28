import type { APIRoute } from 'astro';
import { db } from '../../../db/db';
import { athletes, registrations } from '../../../db/schema';
import { eq, or, and } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request);
    if (!session || !session.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await request.json();
    const { id, firstName, lastName, grade, tshirtSize, medicalInfo } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing athlete ID' }), { status: 400 });
    }

    // Verify ownership
    const athleteData = await db.select({
      athlete: athletes,
      registration: registrations
    })
    .from(athletes)
    .leftJoin(registrations, eq(athletes.registrationId, registrations.id))
    .where(eq(athletes.id, parseInt(id)))
    .limit(1);

    const record = athleteData[0];

    if (!record) {
      return new Response(JSON.stringify({ error: 'Athlete not found' }), { status: 404 });
    }

    const isOwner = (record.athlete.parentId === (session.user as any).id) || 
                    (record.registration?.parentEmail === session.user.email);

    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    // Update athlete
    await db.update(athletes)
      .set({
        firstName,
        lastName,
        grade,
        tshirtSize,
        medicalInfo,
      })
      .where(eq(athletes.id, parseInt(id)));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Update Athlete Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
