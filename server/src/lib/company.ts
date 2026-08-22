import { prisma } from './prisma';

/**
 * Dayflow runs as a SINGLE company.
 *
 * The `Company` row is not a tenant any more — it is the app's configuration
 * record. It still holds the PF rates, professional tax, working days per week
 * and standard day length that the salary and attendance engines read on every
 * request, which is why the table survives even though nobody can create a
 * second one. `companyId` stays on the rows that carry it so the column never
 * has to be migrated away.
 *
 * Nothing in the sign-up flow asks for these any more; they are fixed here.
 */
export const COMPANY_NAME = 'Dayflow';

/** Two letters — the Login ID prefix, e.g. DF in DFDHMO20260001. */
export const COMPANY_CODE = 'DF';

/** The three leave types the wireframe names. */
export const DEFAULT_LEAVE_TYPES = [
  { name: 'Paid Time off', isPaid: true, requiresAttachment: false },
  { name: 'Sick Leave', isPaid: true, requiresAttachment: true },
  { name: 'Unpaid Leaves', isPaid: false, requiresAttachment: false },
];

/**
 * Return the one company, creating it on first use.
 *
 * `upsert` on the unique `code` rather than find-then-create: two sign-ups
 * arriving together on an empty database would both see "no company" and both
 * try to insert. The upsert makes that a single atomic statement.
 */
export async function getCompany() {
  const company = await prisma.company.upsert({
    where: { code: COMPANY_CODE },
    update: {},
    create: { name: COMPANY_NAME, code: COMPANY_CODE },
  });

  // Leave types are seeded alongside, and only if they are missing — a company
  // whose admin has renamed or removed one must not have it silently restored.
  const existing = await prisma.leaveType.count({ where: { companyId: company.id } });
  if (existing === 0) {
    await prisma.leaveType.createMany({
      data: DEFAULT_LEAVE_TYPES.map((t) => ({ ...t, companyId: company.id })),
    });
  }

  return company;
}
