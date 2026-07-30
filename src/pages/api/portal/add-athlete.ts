import type { APIRoute } from 'astro';
import { db } from '../../../db/db';
import { playerProfiles } from '../../../db/schema';
import { getSession } from 'auth-astro/server';
import { portalAthleteSchema } from '../../../lib/schemas';
import { rejectCrossOriginRequest } from '../../../lib/request-security';
import { ensureCanonicalPortalUser } from '../../../lib/portal-ownership';

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

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const portalUser = await ensureCanonicalPortalUser(session.user);
    if (!portalUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const validation = portalAthleteSchema.safeParse(await request.json());
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: validation.error.issues[0]?.message || 'Invalid player details',
      }), { status: 400 });
    }
    const { firstName, lastName, grade, tshirtSize, medicalInfo } = validation.data;

    await db.insert(playerProfiles).values({
      parentId: portalUser.id,
      firstName,
      lastName,
      grade,
      tshirtSize,
      medicalInfo,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Add Athlete Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
