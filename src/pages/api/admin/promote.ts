import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const databaseUrl = import.meta.env.TURSO_DATABASE_URL;
    const ADMIN_PASSCODE = import.meta.env.ADMIN_PASSCODE || 'tvvc2024';

    if (!databaseUrl) {
      return new Response(JSON.stringify({ error: 'Database configuration missing' }), { status: 500 });
    }

    const session = await getSession(request);
    if (!session || !session.user?.email) {
      return new Response(JSON.stringify({ error: 'You must be signed in to promote your account.' }), { status: 401 });
    }

    const body = await request.json();
    const { passcode } = body;

    if (passcode !== ADMIN_PASSCODE) {
      return new Response(JSON.stringify({ error: 'Invalid passcode.' }), { status: 403 });
    }

    const db = getDb(databaseUrl, import.meta.env.TURSO_AUTH_TOKEN || '');

    await db.update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, session.user.email));

    return new Response(JSON.stringify({ success: true, message: 'Your account has been promoted to admin. Please sign out and sign back in for changes to take effect.' }), { status: 200 });

  } catch (err) {
    console.error('Promotion Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
