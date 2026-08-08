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

type FutureCharge = {
  dueDate: string;
  amount: number;
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

export function initialPaymentSucceededEmail(
  context: PaymentEmailContext & {
    paymentOption: 'pay_in_full' | 'standard_plan' | 'custom_plan';
    futureCharges: FutureCharge[];
  }
) {
  const storedPaymentCopy = context.paymentOption === 'standard_plan'
    ? '<strong>There is no December charge.</strong> Stripe securely stores the authorized payment method for these scheduled payments.'
    : 'Stripe securely stores the authorized payment method for these scheduled payments.';
  const schedule = context.futureCharges.length > 0
    ? `
      <h2 style="margin:30px 0 12px;color:#0f172a;font-size:20px">Remaining automatic-payment schedule</h2>
      <ul style="margin:0;padding-left:22px">
        ${context.futureCharges.map((charge) => `<li style="margin:6px 0">${date(charge.dueDate)}: <strong>${money(charge.amount)}</strong></li>`).join('')}
      </ul>
      <p style="margin:14px 0 0">${storedPaymentCopy}</p>`
    : '<p><strong>Your season dues are paid in full.</strong> No future automatic club-season charges are scheduled.</p>';

  return {
    subject: `TVVC registration confirmed: ${context.playerName} — ${context.teamName}`,
    html: shell('Your TVVC roster spot is confirmed', 'Registration and payment confirmation', `
      <p>Hi ${escapeHtml(context.parentName)},</p>
      <p>We received your ${context.paymentOption === 'pay_in_full' ? 'club-season payment' : 'initial club-season payment'} and confirmed ${escapeHtml(context.playerName)}'s roster spot.</p>
      ${details(context, context.paymentOption === 'pay_in_full' ? 'Amount paid' : 'Deposit paid')}
      ${schedule}
      ${context.receiptUrl ? button('View Stripe receipt', context.receiptUrl) : ''}
      ${button('Open parent portal', context.portalUrl)}
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

export function paymentPlanRevisionProposedEmail(context: PaymentEmailContext & { reason: string }) {
  return {
    subject: `Review your revised TVVC payment schedule for ${context.playerName}`,
    html: shell('A revised schedule is ready', 'Parent authorization required', `
      <p>Hi ${escapeHtml(context.parentName)},</p>
      <p>TVVC prepared a revised payment schedule for ${escapeHtml(context.playerName)}. Your current schedule remains active until you review and authorize the revision.</p>
      <p><strong>Reason:</strong> ${escapeHtml(context.reason)}</p>
      <p><strong>Remaining balance:</strong> ${money(context.remainingBalance)}</p>
      <p>No revised automatic charges will begin until you explicitly approve the dates and amounts in the parent portal.</p>
      ${button('Review revised schedule', `${context.portalUrl}#club-season-plan`)}
    `),
  };
}

export function initialCustomPlanProposedEmail(context: PaymentEmailContext & { reason: string }) {
  return {
    subject: `Your TVVC custom payment arrangement is ready for ${context.playerName}`,
    html: shell('Your custom payment arrangement is ready', 'Review before Checkout', `
      <p>Hi ${escapeHtml(context.parentName)},</p>
      <p>TVVC prepared the individualized payment arrangement you requested for ${escapeHtml(context.playerName)}.</p>
      <p><strong>Reason:</strong> ${escapeHtml(context.reason)}</p>
      <p><strong>Amount due at Checkout:</strong> ${money(context.amount)}</p>
      <p><strong>Total season dues:</strong> ${money(context.remainingBalance)}</p>
      <p>No payment will be made and no future automatic charges will be authorized until you sign in, select the custom arrangement, review every date and amount, and complete secure Stripe Checkout.</p>
      ${button('Review registration payment options', context.portalUrl)}
    `),
  };
}

export function paymentPlanRevisionAcceptedEmail(context: PaymentEmailContext) {
  return {
    subject: `TVVC revised payment schedule confirmed for ${context.playerName}`,
    html: shell('Revised schedule confirmed', 'Payment-plan update', `
      <p>Hi ${escapeHtml(context.parentName)},</p>
      <p>Your authorization was recorded and the revised schedule is now active for ${escapeHtml(context.playerName)}.</p>
      <p><strong>Remaining balance:</strong> ${money(context.remainingBalance)}</p>
      <p>The previous unpaid schedule has been retired. Paid installments and receipts remain unchanged.</p>
      ${button('View billing details', context.portalUrl)}
    `),
  };
}

export function financialAccountUpdatedEmail(context: PaymentEmailContext & {
  heading: string;
  explanation: string;
  reason: string;
}) {
  return {
    subject: `TVVC account update for ${context.playerName}: ${context.heading}`,
    html: shell(context.heading, 'Club-season financial update', `
      <p>Hi ${escapeHtml(context.parentName)},</p>
      <p>${escapeHtml(context.explanation)}</p>
      <p><strong>Amount:</strong> ${money(context.amount)}</p>
      <p><strong>Reason:</strong> ${escapeHtml(context.reason)}</p>
      <p><strong>Current balance due:</strong> ${money(context.remainingBalance)}</p>
      ${button('Review your TVVC account', context.portalUrl)}
    `),
  };
}
