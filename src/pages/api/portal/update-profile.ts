import type { APIRoute } from 'astro';
import { db } from '../../../db/db';
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';

export const POST: APIRoute = async ({ request }) => {
  try {
    let session = null;
    try {
      session = await getSession(request);
    } catch (authErr) {
      console.error('Auth Session Error (non-fatal):', authErr);
    }

    if (!session || !session.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { name, emergencyPhone } = await request.json();

    if (typeof name !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid name' }), { status: 400 });
    }

    await db.update(users)
      .set({ 
        name,
        emergencyPhone: typeof emergencyPhone === 'string' ? emergencyPhone : undefined
      })
      .where(eq(users.email, session.user.email));

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Update Profile Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
