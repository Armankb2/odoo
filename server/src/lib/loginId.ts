import type { Prisma } from '@prisma/client';
import { validation } from './errors';

/**
 * Login ID generation, per the wireframe:
 *
 *   OI      company code (Odoo India)
 *   JO      first two letters of the first name
 *   DO      first two letters of the last name
 *   2022    year of joining
 *   0001    serial for that year, resetting annually
 *   → OIJODO20220001
 */

/** Two uppercase letters. Non-alphabetic characters are stripped first (so
 *  "D'Souza" → "DS"), and short names are padded with X rather than producing
 *  a malformed ID. */
function namePart(name: string): string {
  const letters = (name ?? '').normalize('NFD').replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length === 0) throw validation('Name must contain at least one letter');
  return letters.slice(0, 2).padEnd(2, 'X');
}

export function buildLoginId(
  companyCode: string,
  firstName: string,
  lastName: string,
  joiningYear: number,
  serial: number,
): string {
  if (serial > 9999) {
    // The format has no room for a 5th digit; better to fail loudly than to
    // silently emit a 15-character ID that breaks the parser downstream.
    throw validation(`Joining serial ${serial} exceeds the 9999 the ID format allows`);
  }
  return (
    companyCode.toUpperCase() +
    namePart(firstName) +
    namePart(lastName) +
    String(joiningYear).padStart(4, '0') +
    String(serial).padStart(4, '0')
  );
}

/**
 * Atomically claim the next serial for a company/year.
 *
 * `INSERT … ON DUPLICATE KEY UPDATE` is a single statement, so two concurrent
 * employee creations cannot receive the same serial. The obvious alternative,
 * `SELECT COUNT(*) + 1`, races and produces duplicate Login IDs.
 *
 * Must be called with a transaction client so the counter and the user row
 * commit together — otherwise a failed insert burns a serial and leaves a gap.
 */
export async function nextJoiningSerial(
  tx: Prisma.TransactionClient,
  companyId: number,
  year: number,
): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO LoginIdSequence (companyId, year, lastSerial)
    VALUES (${companyId}, ${year}, 1)
    ON DUPLICATE KEY UPDATE lastSerial = lastSerial + 1
  `;

  const row = await tx.loginIdSequence.findUnique({
    where: { companyId_year: { companyId, year } },
    select: { lastSerial: true },
  });

  if (!row) throw new Error('Login ID sequence row vanished mid-transaction');
  return row.lastSerial;
}
