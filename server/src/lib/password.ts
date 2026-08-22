import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const ROUNDS = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * First-time password for an HR-created account. The wireframe requires the
 * system to generate it and the employee to change it on first login.
 *
 * Uses crypto.randomInt rather than Math.random — predictable initial
 * passwords would let anyone who knows the Login ID format sign in as a new
 * hire. Ambiguous characters (O/0, I/l/1) are excluded because these get read
 * off a screen and typed by hand.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function generateTempPassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return out;
}
