import { prisma } from '../lib/prisma';
import { AppError, conflict, unauthenticated, validation } from '../lib/errors';
import { generateTempPassword, hashPassword, verifyPassword } from '../lib/password';
import { buildLoginId, nextJoiningSerial } from '../lib/loginId';
import { getCompany } from '../lib/company';
import type { Role } from '@prisma/client';

/**
 * Sign-up — the public registration path for the single Dayflow company.
 *
 * The caller chooses their own role (Admin or Employee). That is a deliberate
 * product decision, not an oversight: it means **anyone who can reach this
 * endpoint can make themselves an Admin**, with full access to every
 * employee's record and salary. The earlier design created the ADMIN only as
 * a by-product of company registration precisely to prevent that. If this ever
 * faces the open internet, gate it behind an invite code or drop ADMIN from
 * the accepted values.
 *
 * There is no company to create here — `getCompany()` returns the singleton.
 */
export async function signUp(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
}) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw conflict('That email is already registered');

  const company = await getCompany();

  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  const lastName = rest.join(' ') || firstName;
  const now = new Date();
  const joiningYear = now.getFullYear();
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const serial = await nextJoiningSerial(tx, company.id, joiningYear);
    const loginId = buildLoginId(company.code, firstName, lastName, joiningYear, serial);

    const user = await tx.user.create({
      data: {
        companyId: company.id,
        loginId,
        email: input.email,
        passwordHash,
        role: input.role,
        // They chose this password themselves, so there is nothing to force a
        // change of — unlike an HR-created employee with a generated one.
        mustChangePassword: false,
        firstName,
        lastName,
        mobile: input.phone,
        dateOfJoining: now,
        joiningYear,
        joiningSerial: serial,
      },
    });

    return { company, user };
  });
}

/**
 * Sign-in accepts a Login ID or an email — the wireframe labels the field
 * "Login Id/Email" — plus the role the caller says they are signing in as.
 *
 * The role is checked, not trusted: it must match what the account actually
 * holds. It grants nothing (authority still comes from the row in the
 * database), it only stops someone picking "Admin" and landing in an employee
 * session wondering why half the nav is missing.
 */
export async function signIn(identifier: string, password: string, role: Role) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ loginId: identifier }, { email: identifier }] },
  });

  // One message for both "no such user" and "wrong password", so the endpoint
  // cannot be used to discover which Login IDs exist.
  if (!user) throw unauthenticated('Incorrect credentials');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw unauthenticated('Incorrect credentials');
  if (!user.isActive) throw new AppError('ACCOUNT_INACTIVE', 'This account has been deactivated');

  // Only reached once the password has been proven, so naming the account's
  // real role here tells the caller nothing they could not already see after
  // signing in. Checking it before the password would leak which Login IDs are
  // admins to anyone who could guess an ID.
  if (user.role !== role) {
    throw unauthenticated(
      `This is an ${user.role === 'ADMIN' ? 'Admin' : 'Employee'} account. ` +
        `Select ${user.role === 'ADMIN' ? 'Admin' : 'Employee'} and try again.`,
    );
  }

  return user;
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthenticated();

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw validation('Current password is incorrect');
  if (newPassword.length < 8) throw validation('New password must be at least 8 characters');
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw validation('New password must be different from the current one');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    select: { id: true, mustChangePassword: true },
  });
}

export { generateTempPassword };
