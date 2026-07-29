import type { APIRoute } from 'astro';
import { db } from '../../../db/db';
import { athletes, users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';
import { portalAthleteSchema } from '../../../lib/schemas';
import { rejectCrossOriginRequest } from '../../../lib/request-security';

export const POST: APIRoute = async ({ request }) => {
  try {
    const originError = rejectCrossOriginRequest(request);
    if (originError) return originError;

    let session = null;
    try {
      session = await getSession(request);
    } catch (authErr) {
      console.error('Auth Session Error (non-fatal):', authErr);
    }

    if (!session || !session.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Ensure we have the correct user ID from the database
    const [dbUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
    
    const rawUserId = dbUser?.id || (session.user as any).id;
    const userId = (typeof rawUserId === 'string' && rawUserId.trim() !== '') ? rawUserId : null;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID not found' }), { status: 400 });
    }

    const validation = portalAthleteSchema.safeParse(await request.json());
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: validation.error.issues[0]?.message || 'Invalid player details',
      }), { status: 400 });
    }
    const { firstName, lastName, grade, tshirtSize, medicalInfo } = validation.data;

    // Insert new athlete linked to the current user
    await db.insert(athletes).values({
      parentId: userId,
      firstName,
      lastName,
      grade,
      tshirtSize,
      medicalInfo,
      waiverAgreed: false,
      photoReleaseAgreed: false,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Add Athlete Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
