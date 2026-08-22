import { prisma } from '../lib/prisma';
import { AppError, conflict, unauthenticated, validation } from '../lib/errors';
import { generateTempPassword, hashPassword, verifyPassword } from '../lib/password';
import { buildLoginId, nextJoiningSerial } from '../lib/loginId';

/**
 * Company sign-up — the ONLY public registration path.
 *
 * Per the wireframe: "Normal user cannot register." This creates a company and
 * its first ADMIN together. Every subsequent account is created by that admin
 * through the employee endpoints, so nobody can self-assign the ADMIN role.
 */
export async function signUpCompany(input: {
  companyName: string;
  companyCode: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  logoUrl?: string;
}) {
  const code = input.companyCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw validation('Company code must be exactly two letters');
  }

  const [existingCompany, existingUser] = await Promise.all([
    prisma.company.findUnique({ where: { code } }),
    prisma.user.findUnique({ where: { email: input.email } }),
  ]);
  if (existingCompany) throw conflict(`Company code ${code} is already taken`);
  if (existingUser) throw conflict('That email is already registered');

  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  const lastName = rest.join(' ') || firstName;
  const now = new Date();
  const joiningYear = now.getFullYear();
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: input.companyName, code, logoUrl: input.logoUrl },
    });

    // Seed the three leave types the wireframe names.
    await tx.leaveType.createMany({
      data: [
        { companyId: company.id, name: 'Paid Time off', isPaid: true },
        { companyId: company.id, name: 'Sick Leave', isPaid: true, requiresAttachment: true },
        { companyId: company.id, name: 'Unpaid Leaves', isPaid: false },
      ],
    });

    const serial = await nextJoiningSerial(tx, company.id, joiningYear);
    const loginId = buildLoginId(code, firstName, lastName, joiningYear, serial);

    const admin = await tx.user.create({
      data: {
        companyId: company.id,
        loginId,
        email: input.email,
        passwordHash,
        role: 'ADMIN',
        // The founder chose this password, so there is nothing to force a
        // change of — unlike an HR-created employee.
        mustChangePassword: false,
        firstName,
        lastName,
        mobile: input.phone,
        dateOfJoining: now,
        joiningYear,
        joiningSerial: serial,
      },
    });

    return { company, admin };
  });
}

/** Sign-in accepts a Login ID or an email — the wireframe labels the field
 *  "Login Id/Email". */
export async function signIn(identifier: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ loginId: identifier }, { email: identifier }] },
  });

  // One message for both "no such user" and "wrong password", so the endpoint
  // cannot be used to discover which Login IDs exist.
  if (!user) throw unauthenticated('Incorrect credentials');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw unauthenticated('Incorrect credentials');
  if (!user.isActive) throw new AppError('ACCOUNT_INACTIVE', 'This account has been deactivated');

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
