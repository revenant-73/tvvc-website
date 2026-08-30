import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { sessions, users } from '../db/schema';
import { normalizeLoginEmail, verifyAdminPassword } from './admin-password-hash';
import { getSafeCallbackUrl } from './redirects';
import { rejectCrossOriginRequest } from './request-security';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function envValue(key: string) {
  const astroEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return astroEnv?.[key] || process.env[key] || '';
}

function configuredAdminEmails() {
  return envValue('ADMIN_PASSWORD_LOGIN_EMAILS')
    .split(',')
    .map((email) => normalizeLoginEmail(email))
    .filter(Boolean);
}

function isConfigured() {
  return Boolean(envValue('ADMIN_PASSWORD_LOGIN_HASH') && configuredAdminEmails().length);
}

function sessionCookieName(request: Request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const isSecure = forwardedProto === 'https' || new URL(request.url).protocol === 'https:';
  return `${isSecure ? '__Secure-' : ''}authjs.session-token`;
}

function sessionCookie(request: Request, token: string, expires: Date) {
  const secure = sessionCookieName(request).startsWith('__Secure-');
  const parts = [
    `${sessionCookieName(request)}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    `Expires=${expires.toUTCString()}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function handleAdminPasswordLogin(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  if (!isConfigured()) {
    return json({ error: 'Admin password login is not configured.' }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = normalizeLoginEmail(body?.email);
  const password = body?.password;
  const callbackUrl = getSafeCallbackUrl(
    typeof body?.callbackUrl === 'string' ? body.callbackUrl : null,
    '/admin'
  );

  if (!email || typeof password !== 'string') {
    return json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const allowedEmails = configuredAdminEmails();
  const passwordMatches = verifyAdminPassword(password);
  if (!passwordMatches || !allowedEmails.includes(email)) {
    return json({ error: 'Invalid administrator credentials.' }, { status: 401 });
  }

  const databaseUrl = envValue('TURSO_DATABASE_URL');
  if (!databaseUrl) {
    console.error('TURSO_DATABASE_URL is missing while creating an admin password session.');
    return json({ error: 'Database configuration missing.' }, { status: 500 });
  }

  const db = getDb(databaseUrl, envValue('TURSO_AUTH_TOKEN'));
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(sql`lower(trim(${users.email})) = ${email}`)
    .limit(1);

  if (!user || user.role !== 'admin') {
    return json({ error: 'Invalid administrator credentials.' }, { status: 401 });
  }

  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.insert(sessions).values({
    sessionToken: token,
    userId: user.id,
    expires,
  });

  return json(
    { ok: true, callbackUrl },
    {
      headers: {
        'Set-Cookie': sessionCookie(request, token, expires),
      },
    }
  );
}
