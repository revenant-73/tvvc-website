import { schedule } from '@netlify/functions';
import { getDb } from '../../src/db';
import { events, registrations, registrationItems, athletes } from '../../src/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { sendEmail } from '../../src/lib/email';

const handler = async (event: any, context: any) => {
  console.log('Reminder Cron started...');
  
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    console.error('Missing TURSO_DATABASE_URL');
    return { statusCode: 500 };
  }

  const db = getDb(databaseUrl, authToken || '');

  // 1. Calculate the target date (2 days from now)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  const formattedTargetDate = targetDate.toISOString().split('T')[0];

  console.log(`Searching for events starting on: ${formattedTargetDate}`);

  try {
    // 2. Find events starting on the target date
    const eventsStartingSoon = await db.select()
      .from(events)
      .where(eq(events.startDate, formattedTargetDate));

    if (eventsStartingSoon.length === 0) {
      console.log('No events starting in 2 days. Exiting.');
      return { statusCode: 200 };
    }

    console.log(`Found ${eventsStartingSoon.length} events starting soon.`);

    for (const eventItem of eventsStartingSoon) {
      console.log(`Processing reminders for event: ${eventItem.name}`);

      // 3. Find all paid registrations for this event
      const participants = await db.select({
        parentName: registrations.parentName,
        parentEmail: registrations.parentEmail,
        athleteFirstName: athletes.firstName,
        athleteLastName: athletes.lastName,
        eventId: events.id,
        eventName: events.name,
        dateInfo: events.dateInfo,
        timeInfo: events.timeInfo,
      })
      .from(registrationItems)
      .innerJoin(registrations, eq(registrationItems.registrationId, registrations.id))
      .innerJoin(athletes, eq(registrationItems.athleteId, athletes.id))
      .innerJoin(events, eq(registrationItems.eventId, events.id))
      .where(and(
        eq(registrationItems.eventId, eventItem.id),
        eq(registrations.status, 'paid')
      ));

      if (participants.length === 0) {
        console.log(`No paid registrations for ${eventItem.name}.`);
        continue;
      }

      // 4. Group by parentEmail to avoid multiple emails to the same family
      const familyGroups = participants.reduce((acc: any, curr) => {
        if (!acc[curr.parentEmail]) {
          acc[curr.parentEmail] = {
            parentName: curr.parentName,
            email: curr.parentEmail,
            items: []
          };
        }
        acc[curr.parentEmail].items.push(curr);
        return acc;
      }, {});

      // 5. Send emails
      for (const email in familyGroups) {
        const group = familyGroups[email];
        
        const athleteNames = group.items.map((i: any) => `${i.athleteFirstName}`).join(' & ');
        const subject = `Reminder: ${eventItem.name} starts in 2 days!`;
        
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden; color: #333;">
            <div style="background-color: #009695; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">TVVC Event Reminder</h1>
            </div>
            <div style="padding: 30px; line-height: 1.6;">
              <p>Hi everyone,</p>
              <p>This is a reminder that <strong>${eventItem.name}</strong> starts in two days.</p>
              
              <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #E85D4E;">
                <h2 style="margin-top: 0; font-size: 18px; color: #1A1A1A;">Event Details</h2>
                <p style="margin: 5px 0;"><strong>Athletes:</strong> ${athleteNames}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${eventItem.dateInfo}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${eventItem.timeInfo}</p>
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

              ${eventItem.description ? `
              <div style="margin: 25px 0; padding: 15px; background-color: #f0fafa; border-radius: 8px; border: 1px solid #009695;">
                <p style="margin: 0; font-style: italic;">${eventItem.description}</p>
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

        await sendEmail({
          to: group.email,
          subject,
          html
        });
        
        console.log(`Reminder sent to: ${group.email}`);
      }
    }

    return { statusCode: 200 };
  } catch (err) {
    console.error('Error in reminder cron:', err);
    return { statusCode: 500 };
  }
};

// Set the schedule: "0 16 * * *" is 8:00 AM PST (Netlify uses UTC, 16:00 UTC = 8:00 AM PST)
export const config = {
  schedule: "0 16 * * *"
};

export { handler };
