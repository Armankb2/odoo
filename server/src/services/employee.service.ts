import { prisma } from '../lib/prisma';
import { forbidden, notFound } from '../lib/errors';
import { generateTempPassword, hashPassword } from '../lib/password';
import { buildLoginId, nextJoiningSerial } from '../lib/loginId';
import { canViewSalary, filterPatch } from '../policies/fieldPolicy';
import { salaryFor } from './salary.service';
import type { Role } from '@prisma/client';

/**
 * HR/Admin creates an employee. The Login ID and the first password are
 * generated here — never supplied by the caller.
 *
 * The serial claim and the user insert share one transaction, so a failed
 * insert rolls the counter back instead of burning a serial.
 */
export async function createEmployee(
  companyId: number,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfJoining: Date;
    role?: Role;
    jobPosition?: string;
    department?: string;
    location?: string;
    managerId?: number;
    mobile?: string;
  },
) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw notFound('Company not found');

  const joiningYear = input.dateOfJoining.getFullYear();
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.$transaction(async (tx) => {
    const serial = await nextJoiningSerial(tx, companyId, joiningYear);
    const loginId = buildLoginId(
      company.code,
      input.firstName,
      input.lastName,
      joiningYear,
      serial,
    );

    return tx.user.create({
      data: {
        companyId,
        loginId,
        email: input.email,
        passwordHash,
        role: input.role ?? 'EMPLOYEE',
        mustChangePassword: true,
        firstName: input.firstName,
        lastName: input.lastName,
        mobile: input.mobile,
        jobPosition: input.jobPosition,
        department: input.department,
        location: input.location,
        managerId: input.managerId,
        dateOfJoining: input.dateOfJoining,
        joiningYear,
        joiningSerial: serial,
      },
    });
  });

  // Returned once, at creation, so HR can hand it over. It is never readable
  // again — only the hash is stored.
  return { user, tempPassword };
}

/**
 * Full profile. Salary is omitted from the payload entirely for non-admins
 * rather than fetched and hidden — anything sent to the browser is readable.
 */
export async function getEmployee(
  actor: { id: number; companyId: number; role: Role },
  targetId: number,
) {
  const user = await prisma.user.findFirst({
    where: { id: targetId, companyId: actor.companyId },
    include: {
      skills: true,
      certifications: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      // Own salary is visible (read-only); another employee's is omitted from
      // the query entirely rather than fetched and hidden client-side.
      salaryStructure: canViewSalary(actor, targetId) ? { include: { components: true } } : false,
    },
  });

  if (!user) throw notFound('Employee not found');

  const { passwordHash, ...safe } = user;

  // Attach the computed breakdown so the UI never reimplements the formula.
  if ('salaryStructure' in safe && safe.salaryStructure) {
    return { ...safe, salary: await salaryFor(targetId) };
  }
  return safe;
}

export async function updateEmployee(
  actor: { id: number; companyId: number; role: Role },
  targetId: number,
  patch: Record<string, unknown>,
) {
  const target = await prisma.user.findFirst({
    where: { id: targetId, companyId: actor.companyId },
    select: { id: true },
  });
  if (!target) throw notFound('Employee not found');

  // Throws if the caller tried to touch anything outside their allow-list.
  const safePatch = filterPatch(patch, actor.role, actor.id === targetId);

  // Self-lockout guards. An admin demoting or deactivating themselves is
  // almost always a misclick, and if they are the last admin it leaves the
  // company with nobody who can create employees or approve leave.
  if (actor.id === targetId) {
    if (safePatch.role && safePatch.role !== actor.role) {
      throw forbidden('You cannot change your own role');
    }
    if (safePatch.isActive === false) {
      throw forbidden('You cannot deactivate your own account');
    }
  }

  const updated = await prisma.user.update({ where: { id: targetId }, data: safePatch });
  const { passwordHash, ...safe } = updated;
  return safe;
}

/** Employees are deactivated, never deleted — attendance and leave history
 *  must survive their departure. */
export async function deactivateEmployee(companyId: number, targetId: number, actorId?: number) {
  if (actorId === targetId) throw forbidden('You cannot deactivate your own account');

  const target = await prisma.user.findFirst({
    where: { id: targetId, companyId },
    select: { id: true, role: true },
  });
  if (!target) throw notFound('Employee not found');

  // Never leave the company without an admin — nobody could create employees
  // or approve leave afterwards.
  if (target.role === 'ADMIN') {
    const remaining = await prisma.user.count({
      where: { companyId, role: 'ADMIN', isActive: true, id: { not: targetId } },
    });
    if (remaining === 0) throw forbidden('This is the last active admin and cannot be deactivated');
  }

  return prisma.user.update({
    where: { id: targetId },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });
}
