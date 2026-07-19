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
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f1f5f9; border-radius: 12px; overflow: hidden; color: #334155; line-height: 1.6; background-color: #ffffff;">
            <div style="background-color: #009695; height: 6px;"></div>
            
            <div style="padding: 40px 32px 32px; text-align: center;">
              <div style="display: inline-block; background-color: #fff7ed; color: #ea580c; padding: 6px 16px; border-radius: 100px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 20px; border: 1px solid #ffedd5;">
                Upcoming Event
              </div>
              <h1 style="color: #0f172a; margin: 0; font-size: 32px; font-weight: 800; text-transform: uppercase; letter-spacing: -1px; line-height: 1.1;">Event<br><span style="color: #009695;">Reminder</span></h1>
            </div>

            <div style="padding: 0 32px 48px;">
              <p style="font-size: 16px; color: #1e293b; margin-bottom: 24px;">Hi ${athleteNames} and family,</p>
              <p style="font-size: 15px; margin-bottom: 32px;">This is a quick reminder that <strong>${eventItem.name}</strong> starts in just two days! We're excited to have you on the court.</p>
              
              <div style="margin-bottom: 32px; padding: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-left: 4px solid #009695;">
                <h2 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #64748b;">Event Schedule</h2>
                <div style="display: grid; gap: 12px;">
                  <p style="margin: 0; font-size: 14px; color: #1e293b;"><strong>Athletes:</strong> ${athleteNames}</p>
                  <p style="margin: 4px 0; font-size: 14px; color: #1e293b;"><strong>Date:</strong> ${eventItem.dateInfo}</p>
                  <p style="margin: 4px 0; font-size: 14px; color: #1e293b;"><strong>Time:</strong> ${eventItem.timeInfo}</p>
                  <p style="margin: 12px 0 0 0; font-size: 14px; color: #1e293b; line-height: 1.5;">
                    <strong style="color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; display: block; margin-bottom: 4px;">Location</strong>
                    Tualatin Valley Volleyball Club<br>
                    2820 SE 58th Court, #400<br>
                    Hillsboro, OR <span style="color: #64748b; font-size: 12px;">(Behind Floors with Flair)</span>
                  </p>
                </div>
              </div>

              ${eventItem.emailDetails ? `
              <div style="margin-bottom: 32px; padding: 24px; background-color: #f0fdfa; border-radius: 12px; border: 1px solid #ccfbf1; border-left: 4px solid #009695;">
                <h3 style="color: #009695; margin-top: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Specific Instructions</h3>
                <div style="font-size: 14px; color: #0f172a;">${eventItem.emailDetails}</div>
              </div>
              ` : `
              <div style="margin-bottom: 32px; display: grid; gap: 24px;">
                <div>
                  <h3 style="color: #0f172a; margin: 0 0 8px 0; font-size: 14px; font-weight: 700;">Parking Instructions</h3>
                  <p style="margin: 0; font-size: 14px; color: #475569;">Please park in the <strong>Regal Movies at Home</strong> lot and use the pathway leading to our gym doors. You may drop players off near the entrance, but please do not park in the small lot directly outside the gym.</p>
                </div>

                <div>
                  <h3 style="color: #0f172a; margin: 0 0 8px 0; font-size: 14px; font-weight: 700;">Players should bring</h3>
                  <ul style="padding-left: 20px; margin: 0; font-size: 14px; color: #475569; display: grid; gap: 4px;">
                    <li>Volleyball shoes or clean, non-marking court shoes</li>
                    <li>Knee pads</li>
                    <li>A full water bottle</li>
                    <li>A snack or light lunch for the break</li>
                    <li>Comfortable athletic clothing</li>
                  </ul>
                </div>
              </div>
              `}

              <div style="padding: 20px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; margin-bottom: 40px;">
                <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">Arrival: Please arrive a few minutes early so players can check in and be ready to begin at the scheduled start time.</p>
              </div>

              <div style="padding-top: 32px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 700; margin-bottom: 16px;">See you on the court!</p>
                <div style="flex: 1;">
                  <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">Loren Anderson</p>
                  <p style="margin: 0; font-size: 12px; color: #64748b; margin-bottom: 8px;">Director • TVVC</p>
                  <p style="margin: 0; font-size: 13px;"><a href="mailto:loren@tualatinvalleyvb.com" style="color: #009695; text-decoration: none; font-weight: 600;">loren@tualatinvalleyvb.com</a></p>
                  <p style="margin: 2px 0; font-size: 13px; color: #475569;">(503) 389-0760</p>
                  <p style="margin: 0; font-size: 13px;"><a href="https://tualatinvalleyvb.com" style="color: #009695; text-decoration: none; font-weight: 600;">tualatinvalleyvb.com</a></p>
                </div>
              </div>
            </div>
            
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
              &copy; ${new Date().getFullYear()} Tualatin Valley Volleyball Club
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
