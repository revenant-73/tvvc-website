import type { APIRoute } from 'astro';
import { registrations, athletes, registrationItems, events } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '../../../lib/email';
import { generateRegistrationEmail } from '../../../lib/email-templates';
import { requireAdminApiSession } from '../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const authorization = await requireAdminApiSession(request);
    if (!authorization.authorized) return authorization.response;

    const body = await request.json();
    const { athlete, eventId } = body;
    const { db } = authorization;

    // 1. Create a manual registration record
    const registrationId = `manual_${uuidv4()}`;
    const [regResult] = await db.insert(registrations).values({
      id: registrationId,
      parentName: athlete.parentName || 'Manual Entry',
      parentEmail: athlete.parentEmail || '',
      parentPhone: athlete.parentPhone || '',
      status: 'paid', // Manual entries are considered paid
      totalAmount: 0, // Assume 0 or handled externally
    }).returning();

    // 2. Create athlete record
    const [athleteResult] = await db.insert(athletes).values({
      registrationId: registrationId,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      grade: athlete.grade,
      division: athlete.division || null,
      medicalInfo: athlete.medicalInfo || '',
      photoReleaseAgreed: true,
      waiverAgreed: true,
    }).returning({ id: athletes.id });

    if (!athleteResult) {
      throw new Error('Failed to create athlete record');
    }

    // 3. Create registration item
    await db.insert(registrationItems).values({
      registrationId,
      athleteId: athleteResult.id,
      eventId,
    });

    // 4. Increment spots filled
    await db.update(events)
      .set({ spotsFilled: sql`${events.spotsFilled} + 1` })
      .where(eq(events.id, eventId));

    // 5. Send confirmation email if email is provided
    if (regResult && regResult.parentEmail && regResult.parentEmail.includes('@')) {
      try {
        const [eventData] = await db.select().from(events).where(eq(events.id, eventId));
        const [athleteData] = await db.select().from(athletes).where(eq(athletes.id, athleteResult.id));
        
        if (eventData && athleteData) {
          const emailHtml = generateRegistrationEmail(regResult, [{ athlete: athleteData, event: eventData }]);
          await sendEmail({
            to: regResult.parentEmail,
            subject: `TVVC Registration Confirmed: ${eventData.name}`,
            html: emailHtml
          });
        }
      } catch (emailErr) {
        console.error('Manual Registration Email Error:', emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error('Manual Registration Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
