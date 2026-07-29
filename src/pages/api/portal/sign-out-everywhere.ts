import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { db } from '../../../db/db';
import { sessions, users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { rejectCrossOriginRequest } from '../../../lib/request-security';

export const POST: APIRoute = async ({ request }) => {
  try {
    const originError = rejectCrossOriginRequest(request);
    if (originError) return originError;

    const session = await getSession(request);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const [user] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    await db.delete(sessions).where(eq(sessions.userId, user.id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sign Out Everywhere Error:', error);
    return new Response(JSON.stringify({ error: 'Unable to revoke sessions' }), { status: 500 });
  }
};
