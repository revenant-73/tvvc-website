import { athletes, events, registrations } from '../db/schema';

type Registration = typeof registrations.$inferSelect;
type Athlete = typeof athletes.$inferSelect;
type Event = typeof events.$inferSelect;

export function generateRegistrationEmail(
  registration: Registration,
  items: { athlete: Athlete; event: Event }[]
) {
  const eventDetailsHtml = items
    .map(
      ({ athlete, event }) => `
    <div style="margin-bottom: 24px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; border-left: 4px solid #009695;">
      <h3 style="margin: 0 0 12px 0; color: #1A1A1A; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">${event.name}</h3>
      <div style="display: grid; gap: 8px;">
        <p style="margin: 0; font-size: 13px; color: #64748b;"><strong style="color: #1A1A1A; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Athlete</strong><br>${athlete.firstName} ${athlete.lastName}</p>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;"><strong style="color: #1A1A1A; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Schedule</strong><br>${event.dateInfo} • ${event.timeInfo || 'TBA'}</p>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;"><strong style="color: #1A1A1A; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Location</strong><br>${(event.type === 'tryout' || (event.type === 'clinic' && event.name.toLowerCase().includes('tryout'))) ? 'Century High School (Main Gym)' : 'TVVC Gym'}</p>
      </div>
      ${
        event.emailDetails
          ? `<div style="margin-top: 16px; padding-top: 16px; font-size: 13px; color: #475569; border-top: 1px dashed #cbd5e1;">${event.emailDetails}</div>`
          : ''
      }
    </div>
  `
    )
    .join('');

  const totalAmount = (registration.totalAmount / 100).toFixed(2);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
      <div style="background-color: #009695; height: 6px; border-radius: 12px 12px 0 0;"></div>
      
      <div style="padding: 48px 32px 32px; text-align: center; border: 1px solid #f1f5f9; border-bottom: none; border-top: none; background-color: #ffffff;">
        <div style="display: inline-block; background-color: #f0fdfa; color: #009695; padding: 6px 16px; border-radius: 100px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 20px; border: 1px solid #ccfbf1;">
          Payment Successful
        </div>
        <h1 style="color: #0f172a; margin: 0; font-size: 32px; font-weight: 800; text-transform: uppercase; letter-spacing: -1px; line-height: 1.1;">Registration<br><span style="color: #009695;">Confirmed</span></h1>
      </div>
      
      <div style="padding: 0 32px 48px; border: 1px solid #f1f5f9; border-top: none; border-radius: 0 0 12px 12px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #1e293b; margin-bottom: 24px;">Hi ${registration.parentName},</p>
        <p style="font-size: 15px; margin-bottom: 32px;">Thank you for joining <strong>Tualatin Valley Volleyball Club</strong>! Your registration is officially complete and your spot is reserved.</p>
        
        <h2 style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #64748b; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">Registration Details</h2>
        ${eventDetailsHtml}
        
        <div style="margin: 40px 0; padding: 24px; background-color: #0f172a; color: #ffffff; border-radius: 16px; text-align: center;">
          <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 700;">Total Paid</p>
          <p style="margin: 4px 0 0 0; font-size: 36px; font-weight: 800; color: #ffffff;">$${totalAmount}</p>
          <p style="margin: 12px 0 0 0; font-size: 10px; color: #475569; font-family: monospace; letter-spacing: 1px;">ID: ${registration.id.toUpperCase()}</p>
        </div>
        
        <p style="font-size: 14px; color: #64748b; text-align: center; margin-bottom: 40px;">Questions? Simply reply to this email or visit our website.</p>
        
        <div style="padding-top: 32px; border-top: 1px solid #f1f5f9;">
          <p style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 700; margin-bottom: 16px;">See you on the court!</p>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="flex: 1;">
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">Loren Anderson</p>
              <p style="margin: 0; font-size: 12px; color: #64748b; margin-bottom: 8px;">Director • TVVC</p>
              <p style="margin: 0; font-size: 13px;"><a href="mailto:loren@tualatinvalleyvb.com" style="color: #009695; text-decoration: none; font-weight: 600;">loren@tualatinvalleyvb.com</a></p>
              <p style="margin: 2px 0; font-size: 13px; color: #475569;">(503) 389-0760</p>
              <p style="margin: 0; font-size: 13px;"><a href="https://tualatinvalleyvb.com" style="color: #009695; text-decoration: none; font-weight: 600;">tualatinvalleyvb.com</a></p>
            </div>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
        <p>© ${new Date().getFullYear()} Tualatin Valley Volleyball Club. All rights reserved.</p>
      </div>
    </div>
  `;
}
