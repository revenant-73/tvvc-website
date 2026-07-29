import type { APIRoute } from 'astro';
import { db } from '../../../db/db';
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';
import { portalProfileSchema } from '../../../lib/schemas';
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

    const validation = portalProfileSchema.safeParse(await request.json());
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: validation.error.issues[0]?.message || 'Invalid profile details',
      }), { status: 400 });
    }
    const { name, emergencyPhone } = validation.data;

    await db.update(users)
      .set({ 
        name,
        emergencyPhone
      })
      .where(eq(users.email, session.user.email));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Update Profile Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
