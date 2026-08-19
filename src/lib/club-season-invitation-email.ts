import { createHash } from 'node:crypto';

export type InvitationEmailModel = {
  parentName: string;
  playerName: string;
  teamName: string;
  acceptanceDeadline: string;
  totalAmount: number;
  depositAmount: number;
  installmentAmount: number;
  installmentCount: number;
  installmentDates: string[];
  siteOrigin?: string;
};

export function escapeInvitationHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function date(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`));
}

export function safeInvitationOrigin(candidate?: string): string {
  try {
    const parsed = new URL(candidate || 'https://tualatinvalleyvb.com');
    const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !localHttp) throw new Error('unsafe origin');
    return parsed.origin;
  } catch {
    return 'https://tualatinvalleyvb.com';
  }
}

export function renderClubSeasonInvitationEmail(model: InvitationEmailModel) {
  const origin = safeInvitationOrigin(model.siteOrigin);
  const registrationUrl = `${origin}/season-registration`;
  const subject = `TVVC team invitation: ${model.playerName} — ${model.teamName}`;
  const installmentRows = model.installmentDates.map((dueDate, index) =>
    `<li style="margin:6px 0">Payment ${index + 1}: <strong>${escapeInvitationHtml(money(model.installmentAmount))}</strong> on ${escapeInvitationHtml(date(dueDate))}</li>`
  ).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7f8;color:#132033;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:auto;background:#fff;border:1px solid #dce5e8;border-top:7px solid #009695"><tr><td style="padding:34px"><p style="margin:0 0 10px;color:#009695;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase">2026–2027 club season</p><h1 style="margin:0 0 22px;font-size:30px;line-height:1.12;color:#111827">You’re invited to join TVVC</h1><p>Hi ${escapeInvitationHtml(model.parentName)},</p><p>We are excited to offer <strong>${escapeInvitationHtml(model.playerName)}</strong> a spot on <strong>${escapeInvitationHtml(model.teamName)}</strong>.</p><div style="margin:24px 0;padding:18px;border-left:4px solid #e85d4e;background:#f8fafb"><p style="margin:0"><strong>Please respond by ${escapeInvitationHtml(date(model.acceptanceDeadline))}.</strong></p></div><p><a href="${escapeInvitationHtml(registrationUrl)}" style="display:inline-block;padding:14px 20px;background:#009695;color:#fff;text-decoration:none;font-weight:800;border-radius:8px">Review invitation &amp; register</a></p><p style="font-size:13px;color:#536175">This is a private shared registration page. Sign in using the email address that received this message.</p><h2 style="margin:30px 0 10px;font-size:19px">Season dues</h2><p>Total dues are <strong>${escapeInvitationHtml(money(model.totalAmount))}</strong>. Choose either pay in full during registration or the standard payment plan:</p><ul><li style="margin:6px 0"><strong>${escapeInvitationHtml(money(model.depositAmount))}</strong> deposit due at registration</li>${installmentRows}</ul><p style="padding:12px;background:#fff8e6;border:1px solid #f0cf72"><strong>December break:</strong> no payment is scheduled in December. The five monthly charges run January through May on the fifth.</p><p>If your family needs a different payment arrangement, contact Loren before completing registration so TVVC can prepare a custom plan.</p><p>CEVA/USAV membership fees are purchased separately by families and are not included in club dues.</p><p style="margin-top:28px">Questions? Reply to this email or contact Loren at <a href="mailto:loren@tualatinvalleyvb.com">loren@tualatinvalleyvb.com</a>.</p><p style="margin:28px 0 0;font-weight:800">Tualatin Valley Volleyball Club</p></td></tr></table></td></tr></table></body></html>`;
  const templateFingerprint = createHash('sha256').update(`${subject}\n${html}`).digest('hex');
  return { subject, html, registrationUrl, templateFingerprint };
}
