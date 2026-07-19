import 'dotenv/config';
import { getDb } from '../src/db';
import { events, registrations, registrationItems, athletes } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '../src/lib/email';

async function testReminder() {
  console.log('--- Manual Reminder Test ---');
  
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    console.error('Missing TURSO_DATABASE_URL');
    return;
  }

  const db = getDb(databaseUrl, authToken || '');

  // 1. Calculate the target date (2 days from now)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  const formattedTargetDate = targetDate.toISOString().split('T')[0];

  console.log(`Searching for any "paid" registration to use as a test...`);

  // 2. Find ANY paid registration + event to use for the test
  const testSubject = await db.select({
    parentName: registrations.parentName,
    parentEmail: registrations.parentEmail,
    athleteFirstName: athletes.firstName,
    eventId: events.id,
    eventName: events.name,
    dateInfo: events.dateInfo,
    timeInfo: events.timeInfo,
    description: events.description
  })
  .from(registrationItems)
  .innerJoin(registrations, eq(registrationItems.registrationId, registrations.id))
  .innerJoin(athletes, eq(registrationItems.athleteId, athletes.id))
  .innerJoin(events, eq(registrationItems.eventId, events.id))
  .where(eq(registrations.status, 'paid'))
  .limit(1);

  if (testSubject.length === 0) {
    console.error('No paid registrations found in database to test with.');
    return;
  }

  const item = testSubject[0];
  const TEST_RECIPIENT = 'loren@tualatinvalleyvb.com';
  
  console.log(`Found test case: ${item.athleteFirstName} registered for ${item.eventName}`);
  console.log(`OVERRIDING recipient for safety. Sending test email to: ${TEST_RECIPIENT}`);

  // 3. Construct the HTML (same as in the cron)
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden; color: #333;">
      <div style="background-color: #009695; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">TVVC Event Reminder (TEST)</h1>
      </div>
      <div style="padding: 30px; line-height: 1.6;">
        <p>Hi ${item.athleteFirstName} and family,</p>
        <p>This is a reminder that <strong>${item.eventName}</strong> starts in two days.</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #E85D4E;">
          <h2 style="margin-top: 0; font-size: 18px; color: #1A1A1A;">Event Details</h2>
          <p style="margin: 5px 0;"><strong>Athletes:</strong> ${item.athleteFirstName}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${item.dateInfo}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${item.timeInfo}</p>
          <p style="margin: 15px 0 5px 0;"><strong>Location:</strong><br>
          Tualatin Valley Volleyball Club<br>
          2820 SE 58th Court, #400<br>
          Hillsboro, OR<br>
          <span style="color: #666; font-size: 0.9em;">(Behind Floors with Flair)</span></p>
        </div>

        <h3 style="color: #009695; margin-bottom: 10px;">Parking Instructions:</h3>
        <p style="margin-top: 0;">Please park in the <strong>Regal Movies at Home</strong> lot and use the pathway leading to our gym doors. You may drop players off near the entrance, but please do not park in the small lot directly outside the gym.</p>

        <h3 style="color: #009695; margin-bottom: 10px;">Players should bring:</h3>
        <ul style="padding-left: 20px; margin-top: 0;">
          <li>Volleyball shoes or clean, non-marking court shoes</li>
          <li>Knee pads</li>
          <li>A full water bottle</li>
          <li>A snack or light lunch for the break</li>
          <li>Comfortable athletic clothing</li>
          <li>Any personal items they may need</li>
        </ul>

        <h3 style="color: #009695; margin-bottom: 10px;">Arrival:</h3>
        <p style="margin-top: 0;">Please arrive a few minutes early so players can check in and be ready to begin at the scheduled start time.</p>

        ${item.description ? `
        <div style="margin: 25px 0; padding: 15px; background-color: #f0fafa; border-radius: 8px; border: 1px solid #009695;">
          <p style="margin: 0; font-style: italic;">${item.description}</p>
        </div>
        ` : ''}

        <p>We’re looking forward to seeing everyone on the court!</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0;"><strong>Loren Anderson</strong> | he/him | Director</p>
          <p style="margin: 0;">Tualatin Valley Volleyball Club</p>
          <p style="margin: 0;"><a href="mailto:loren@tualatinvalleyvb.com" style="color: #009695;">loren@tualatinvalleyvb.com</a></p>
          <p style="margin: 0;">(503) 389-0760</p>
          <p style="margin: 0;"><a href="https://tualatinvalleyvb.com" style="color: #009695;">tualatinvalleyvb.com</a></p>
        </div>
      </div>
      <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #777;">
        &copy; 2026 Tualatin Valley Volleyball Club
      </div>
    </div>
  `;

  try {
    await sendEmail({
      to: TEST_RECIPIENT,
      subject: `[TEST] Reminder: ${item.eventName} starts in 2 days!`,
      html
    });
    console.log(`Test email sent successfully to ${TEST_RECIPIENT}!`);
  } catch (err) {
    console.error('Failed to send test email:', err);
  }
}

testReminder();
