import type { APIRoute } from 'astro';
import { db } from '../../../db/db';
import { athletes, users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request);
    if (!session || !session.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Ensure we have the correct user ID from the database
    const [dbUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
    
    const userId = dbUser?.id || (session.user as any).id;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID not found' }), { status: 400 });
    }

    const body = await request.json();
    const { firstName, lastName, grade, tshirtSize, medicalInfo } = body;

    if (!firstName || !lastName || !grade) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // Insert new athlete linked to the current user
    await db.insert(athletes).values({
      parentId: userId,
      firstName,
      lastName,
      grade,
      tshirtSize,
      medicalInfo,
      waiverAgreed: true, // Assuming agreement if adding via portal
      photoReleaseAgreed: true,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Add Athlete Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
