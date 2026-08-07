type PaymentEmailContext = {
  parentName: string;
  playerName: string;
  teamName: string;
  amount: number;
  dueDate: string;
  remainingBalance: number;
  portalUrl: string;
  receiptUrl?: string | null;
  attemptNumber?: number;
};

const money = (cents: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(cents / 100);

const date = (value: string) => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${value}T12:00:00Z`));

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function shell(title: string, eyebrow: string, body: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;color:#334155;background:#fff;line-height:1.6">
      <div style="height:6px;background:#009695"></div>
      <div style="padding:34px 30px 38px">
        <p style="margin:0 0 8px;color:#009695;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px">${eyebrow}</p>
        <h1 style="margin:0 0 22px;color:#0f172a;font-size:28px;line-height:1.15">${title}</h1>
        ${body}
        <div style="margin-top:32px;padding-top:22px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b">
          <strong style="color:#0f172a">Tualatin Valley Volleyball Club</strong><br>
          Questions? Reply to this email or contact Loren at (503) 389-0760.
        </div>
      </div>
    </div>`;
}

function details(context: PaymentEmailContext, paymentLabel: string): string {
  return `
    <div style="margin:24px 0;padding:20px;border-radius:12px;background:#f8fafc;border-left:4px solid #009695">
      <p style="margin:0 0 7px"><strong>Player:</strong> ${escapeHtml(context.playerName)}</p>
      <p style="margin:0 0 7px"><strong>Team:</strong> ${escapeHtml(context.teamName)}</p>
      <p style="margin:0 0 7px"><strong>${paymentLabel}:</strong> ${money(context.amount)}</p>
      <p style="margin:0 0 7px"><strong>Scheduled date:</strong> ${date(context.dueDate)}</p>
      <p style="margin:0"><strong>Remaining season balance:</strong> ${money(context.remainingBalance)}</p>
    </div>`;
}

function button(label: string, url: string): string {
  return `<p style="margin:26px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 19px;border-radius:9px;background:#009695;color:#fff;text-decoration:none;font-size:13px;font-weight:800">${label}</a></p>`;
}

export function upcomingPaymentEmail(context: PaymentEmailContext) {
  return {
    subject: `Upcoming TVVC payment: ${money(context.amount)} on ${date(context.dueDate)}`,
    html: shell('Automatic payment reminder', 'Upcoming club-season payment', `
      <p>Hi ${escapeHtml(context.parentName)},</p>
      <p>This is a reminder that TVVC will automatically charge the card saved with Stripe according to the payment schedule you authorized.</p>
      ${details(context, 'Amount to be charged')}
      <p>No action is needed if your payment method is current. To review or update billing information, sign in to the parent portal.</p>
      ${button('Open parent portal', context.portalUrl)}
    `),
  };
}

export function paymentSucceededEmail(context: PaymentEmailContext) {
  return {
    subject: `TVVC payment received: ${money(context.amount)}`,
    html: shell('Payment received', 'Club-season payment confirmation', `
      <p>Hi ${escapeHtml(context.parentName)},</p>
      <p>We successfully received your scheduled club-season payment.</p>
      ${details(context, 'Amount paid')}
      ${context.receiptUrl ? button('View Stripe receipt', context.receiptUrl) : button('View payment details', context.portalUrl)}
    `),
  };
}

export function paymentFailedEmail(context: PaymentEmailContext, actionRequired: boolean) {
  const retryCopy = actionRequired
    ? 'Automatic attempts have stopped. Please update your payment method and contact TVVC so we can complete the payment securely.'
    : `This attempt did not complete. TVVC will retry according to the agreed recovery schedule; this was attempt ${context.attemptNumber || 1} of 3.`;
  return {
    subject: `Action needed: TVVC payment of ${money(context.amount)} did not complete`,
    html: shell('Payment needs attention', 'Club-season payment update', `
      <p>Hi ${escapeHtml(context.parentName)},</p>
      <p>${retryCopy}</p>
      ${details(context, 'Amount due')}
      <p><strong>Your player remains on the roster.</strong> A failed payment does not automatically cancel the registration or remove the player from the team.</p>
      ${button('Update billing information', context.portalUrl)}
    `),
  };
}

export function adminPaymentAlertEmail(context: PaymentEmailContext, failureMessage: string) {
  return {
    subject: `TVVC payment follow-up required: ${context.playerName}`,
    html: shell('Manual follow-up required', 'Club-season billing alert', `
      <p>The automatic recovery sequence requires staff review.</p>
      ${details(context, 'Outstanding installment')}
      <p><strong>Processor message:</strong> ${escapeHtml(failureMessage || 'No processor detail was provided.')}</p>
      ${button('Open admin dashboard', `${context.portalUrl.replace('/portal/dashboard', '')}/admin`)}
    `),
  };
}
