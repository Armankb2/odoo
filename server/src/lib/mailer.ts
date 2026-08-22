import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outbound email.
 *
 * Configured entirely from the environment. Gmail needs an **app password**
 * (Google Account → Security → 2-Step Verification → App passwords), not the
 * account password, and the 16 characters must be given without the spaces
 * Google displays them with.
 */

let cached: Transporter | null = null;

export function mailerConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    // 587 is STARTTLS: connect in the clear, then upgrade. `secure: true` is
    // for implicit TLS on 465 and fails on 587 with a confusing timeout.
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
  return cached;
}

export async function sendMail(to: string, subject: string, text: string, html?: string) {
  // Without SMTP credentials the app still has to work — otherwise nobody can
  // sign up on a fresh clone. Fall back to logging the message, which in
  // practice means the OTP is readable in the server console.
  if (!mailerConfigured()) {
    console.warn(
      `[mailer] SMTP not configured; not sending. Would have sent to ${to}:\n${text}`,
    );
    return { delivered: false as const };
  }

  await transporter().sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER!,
    to,
    subject,
    text,
    html,
  });
  return { delivered: true as const };
}
