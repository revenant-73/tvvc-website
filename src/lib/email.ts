import { Resend } from 'resend';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  idempotencyKey?: string;
}

export async function sendEmail({ to, subject, html, idempotencyKey }: EmailPayload) {
  if (!process.env.RESEND_API_KEY || process.env.PLAYWRIGHT_TEST === '1') {
    console.warn('Email sending is disabled. Skipping email send.');
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send(
      {
        from: 'TVVC Volleyball <reminders@mail.tualatinvalleyvb.com>',
        replyTo: 'loren@tualatinvalleyvb.com',
        to,
        subject,
        html,
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );
    if (result.error) throw new Error(result.error.message);
    return result.data;
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    throw error;
  }
}
