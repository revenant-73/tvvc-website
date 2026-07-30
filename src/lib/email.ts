import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  if (!process.env.RESEND_API_KEY || process.env.PLAYWRIGHT_TEST === '1') {
    console.warn('Email sending is disabled. Skipping email send.');
    return;
  }

  try {
    const data = await resend.emails.send({
      from: 'TVVC Volleyball <reminders@mail.tualatinvalleyvb.com>',
      reply_to: 'loren@tualatinvalleyvb.com',
      to,
      subject,
      html,
    });

    return data;
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    throw error;
  }
}
