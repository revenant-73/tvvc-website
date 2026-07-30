import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../db/db';
import { householdGuardians, users } from '../../../db/schema';
import { sendEmail } from '../../../lib/email';
import { ensureCanonicalPortalUser } from '../../../lib/portal-ownership';
import { rejectCrossOriginRequest } from '../../../lib/request-security';
import { portalGuardianAccessSchema } from '../../../lib/schemas';

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] || character);

export const POST: APIRoute = async ({ request }) => {
  try {
    const originError = rejectCrossOriginRequest(request);
    if (originError) return originError;

    const session = await getSession(request);
    if (!session) return json({ error: 'Unauthorized' }, 401);

    const portalUser = await ensureCanonicalPortalUser(session.user);
    if (!portalUser) return json({ error: 'Unauthorized' }, 401);

    const validation = portalGuardianAccessSchema.safeParse(await request.json());
    if (!validation.success) {
      return json({
        error: validation.error.issues[0]?.message || 'Invalid guardian action',
      }, 400);
    }

    const now = new Date().toISOString();

    if (validation.data.action === 'revoke') {
      const updated = await db.update(householdGuardians)
        .set({
          guardianUserId: null,
          status: 'revoked',
          revokedAt: now,
          updatedAt: now,
        })
        .where(and(
          eq(householdGuardians.id, validation.data.accessId),
          eq(householdGuardians.ownerUserId, portalUser.id),
          isNull(householdGuardians.revokedAt)
        ))
        .returning({ id: householdGuardians.id });

      return updated.length > 0
        ? json({ success: true }, 200)
        : json({ error: 'Guardian access not found.' }, 404);
    }

    const guardianEmail = validation.data.email;
    if (guardianEmail === portalUser.email.trim().toLowerCase()) {
      return json({ error: 'Use a different email for the invited guardian.' }, 400);
    }

    const [existingAccess] = await db.select({
      id: householdGuardians.id,
      status: householdGuardians.status,
      revokedAt: householdGuardians.revokedAt,
    })
      .from(householdGuardians)
      .where(and(
        eq(householdGuardians.ownerUserId, portalUser.id),
        eq(householdGuardians.guardianEmail, guardianEmail)
      ))
      .limit(1);

    if (existingAccess?.status === 'active' && !existingAccess.revokedAt) {
      return json({ error: 'That guardian already has active view access.' }, 409);
    }

    if (existingAccess) {
      await db.update(householdGuardians)
        .set({
          guardianUserId: null,
          status: 'pending',
          invitedAt: now,
          acceptedAt: null,
          revokedAt: null,
          updatedAt: now,
        })
        .where(eq(householdGuardians.id, existingAccess.id));
    } else {
      await db.insert(householdGuardians).values({
        ownerUserId: portalUser.id,
        guardianEmail,
        status: 'pending',
        invitedAt: now,
        updatedAt: now,
      });
    }

    const [owner] = await db.select({ name: users.name })
      .from(users)
      .where(eq(users.id, portalUser.id))
      .limit(1);
    const ownerName = owner?.name?.trim() || 'A TVVC parent';
    const loginUrl = new URL(
      '/portal/login?callbackUrl=/portal/dashboard',
      request.url
    ).toString();

    let emailSent = true;
    try {
      const emailResult = await sendEmail({
        to: guardianEmail,
        subject: `${ownerName} shared their TVVC household with you`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a">
            <h1 style="color:#009695">TVVC household access</h1>
            <p><strong>${escapeHtml(ownerName)}</strong> invited you to view their TVVC players, schedules, and order history.</p>
            <p>This access is view-only. Billing, receipts, registrations, and player management remain with the primary parent.</p>
            <p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#009695;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Sign in to TVVC</a></p>
            <p>Use <strong>${escapeHtml(guardianEmail)}</strong> when signing in. If you were not expecting this invitation, you can ignore this email.</p>
          </div>
        `,
      });
      emailSent = Boolean(emailResult);
    } catch (error) {
      emailSent = false;
      console.error('Guardian invitation email failed:', error);
    }

    return json({ success: true, emailSent }, 200);
  } catch (error) {
    console.error('Guardian Access Error:', error);
    return json({ error: 'Unable to update guardian access.' }, 500);
  }
};
