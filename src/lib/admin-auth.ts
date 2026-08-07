import { eq } from 'drizzle-orm';
import { getSession } from 'auth-astro/server';
import { getDb } from '../db';
import { users } from '../db/schema';
import { rejectCrossOriginRequest } from './request-security';

type Database = ReturnType<typeof getDb>;

type AdminApiAuthorization =
  | {
      authorized: true;
      db: Database;
      user: {
        id: string;
        email: string;
      };
    }
  | {
      authorized: false;
      response: Response;
    };

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getCurrentAdminUser(request: Request) {
  let session;
  try { session = await getSession(request); } catch { return null; }
  const sessionUserId = (session?.user as { id?: unknown } | undefined)?.id;
  if (typeof sessionUserId !== 'string' || !sessionUserId.trim()) return null;
  const databaseUrl = import.meta.env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) return null;
  const database = getDb(databaseUrl, import.meta.env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || '');
  const [user] = await database.select({ id: users.id, email: users.email, role: users.role })
    .from(users).where(eq(users.id, sessionUserId)).limit(1);
  return user?.role === 'admin' ? { id: user.id, email: user.email } : null;
}

/**
 * Authorize a browser request to an admin API using the server-side Auth.js
 * session and the user's current database role. Never trust role or passcode
 * values supplied by browser JavaScript.
 */
export async function requireAdminApiSession(
  request: Request
): Promise<AdminApiAuthorization> {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) {
    return { authorized: false, response: originRejection };
  }

  let session;
  try {
    session = await getSession(request);
  } catch (error) {
    console.error('Admin session lookup failed:', error);
    return {
      authorized: false,
      response: jsonError('Unable to verify administrator session', 500),
    };
  }

  const sessionUserId = (session?.user as { id?: unknown } | undefined)?.id;
  if (typeof sessionUserId !== 'string' || !sessionUserId.trim()) {
    return {
      authorized: false,
      response: jsonError('Authentication required', 401),
    };
  }

  const databaseUrl = import.meta.env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    console.error('TURSO_DATABASE_URL is missing while authorizing an admin request.');
    return {
      authorized: false,
      response: jsonError('Database configuration missing', 500),
    };
  }

  const db = getDb(
    databaseUrl,
    import.meta.env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || ''
  );
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, sessionUserId))
    .limit(1);

  if (!user || user.role !== 'admin') {
    return {
      authorized: false,
      response: jsonError('Administrator access required', 403),
    };
  }

  return {
    authorized: true,
    db,
    user: { id: user.id, email: user.email },
  };
}
