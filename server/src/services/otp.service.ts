import crypto from 'node:crypto';
import { prisma } from '../lib/prisma';
import { conflict, validation } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { sendMail } from '../lib/mailer';

/**
 * Sign-up email verification (PDF §3.1.1).
 *
 * A six-digit code is emailed to the address the person typed, and sign-up
 * refuses to create the account until that code comes back. This proves the
 * address exists and belongs to them, which matters here more than usual:
 * sign-up lets the caller choose the ADMIN role.
 */

const TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES ?? 10);
/** Seconds a caller must wait before asking for another code. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Wrong guesses allowed before the code is dead. */
const MAX_ATTEMPTS = 5;

/**
 * `crypto.randomInt` rather than `Math.random`: it is uniform and
 * cryptographically seeded. `Math.random` is neither, and this is a
 * credential, however short-lived.
 */
function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

const normalise = (email: string) => email.trim().toLowerCase();

/** Issue a code and email it. */
export async function sendSignUpOtp(rawEmail: string) {
  const email = normalise(rawEmail);

  // Verifying an address that is already an account would be pointless, and
  // the sign-up would fail at the end anyway. Fail early with the same message
  // sign-up gives.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict('That email is already registered');

  const latest = await prisma.emailVerification.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  });

  // Without a cooldown this endpoint is an open relay for mailbombing anyone
  // whose address the caller knows.
  if (latest && !latest.consumedAt) {
    const ageSeconds = (Date.now() - latest.createdAt.getTime()) / 1000;
    if (ageSeconds < RESEND_COOLDOWN_SECONDS) {
      throw validation(
        `A code was just sent. Please wait ${Math.ceil(
          RESEND_COOLDOWN_SECONDS - ageSeconds,
        )} seconds before requesting another.`,
      );
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000);

  // Retire any earlier live codes, so only the newest one works. Otherwise
  // requesting a second code leaves the first valid and doubles the guess
  // surface.
  await prisma.emailVerification.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.emailVerification.create({
    data: { email, codeHash: await hashPassword(code), expiresAt },
  });

  const { delivered } = await sendMail(
    email,
    'Your Dayflow verification code',
    `Your Dayflow verification code is ${code}.\n\n` +
      `It expires in ${TTL_MINUTES} minutes. If you did not request this, ignore this email.`,
    `<p>Your Dayflow verification code is:</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
     <p>It expires in ${TTL_MINUTES} minutes. If you did not request this, ignore this email.</p>`,
  );

  return { email, expiresAt, delivered };
}

/**
 * Check a code without consuming it.
 *
 * Consuming happens only after the account is actually created — see
 * `consumeOtp`. Burning the code first would mean any later failure (a
 * duplicate email slipping through, a database error) left the person holding
 * a dead code and no account.
 *
 * A wrong guess costs an attempt. A right guess does not reset the counter,
 * because the row is about to be consumed anyway.
 */
export async function verifyOtp(rawEmail: string, code: string) {
  const email = normalise(rawEmail);

  const row = await prisma.emailVerification.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) throw validation('Request a verification code first');
  if (row.expiresAt < new Date()) {
    throw validation('That code has expired. Request a new one.');
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw validation('Too many incorrect attempts. Request a new code.');
  }

  if (!(await verifyPassword(code, row.codeHash))) {
    await prisma.emailVerification.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    throw validation(
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
        : 'Incorrect code. Request a new one.',
    );
  }

  return row.id;
}

/** Mark a verified code as used, once the account exists. */
export async function consumeOtp(id: number) {
  await prisma.emailVerification.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}
