import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { generateTempPassword, hashPassword } from '../lib/password';
import { buildLoginId, nextJoiningSerial } from '../lib/loginId';
import { canViewSalary, filterPatch } from '../policies/fieldPolicy';
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
      salaryStructure: canViewSalary(actor) ? { include: { components: true } } : false,
    },
  });

  if (!user) throw notFound('Employee not found');

  const { passwordHash, ...safe } = user;
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

  const updated = await prisma.user.update({ where: { id: targetId }, data: safePatch });
  const { passwordHash, ...safe } = updated;
  return safe;
}

/** Employees are deactivated, never deleted — attendance and leave history
 *  must survive their departure. */
export async function deactivateEmployee(companyId: number, targetId: number) {
  const target = await prisma.user.findFirst({
    where: { id: targetId, companyId },
    select: { id: true },
  });
  if (!target) throw notFound('Employee not found');

  return prisma.user.update({
    where: { id: targetId },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });
}
