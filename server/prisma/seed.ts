import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Demo data.
 *
 * Seed quality is a demo feature, not a chore — empty tables make a finished
 * app look broken. The attendance data deliberately includes weekend gaps,
 * absences and a missing check-out, because those exercise the yellow-dot and
 * null-checkout paths that an all-happy dataset hides.
 */

const prisma = new PrismaClient();

const COMPANY_CODE = 'OI';
const DEMO_PASSWORD = 'password123';

function namePart(name: string) {
  return name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2).padEnd(2, 'X');
}

function loginIdFor(first: string, last: string, year: number, serial: number) {
  return (
    COMPANY_CODE + namePart(first) + namePart(last) + String(year) + String(serial).padStart(4, '0')
  );
}

/** Component rules exactly as the wireframe defines them. Amounts are never
 *  stored — only these rules. */
const COMPONENT_RULES: Prisma.SalaryComponentCreateWithoutSalaryStructureInput[] = [
  { name: 'Basic Salary', computationType: 'PERCENT', basis: 'WAGE', value: 50, sortOrder: 1 },
  { name: 'House Rent Allowance', computationType: 'PERCENT', basis: 'BASIC', value: 50, sortOrder: 2 },
  { name: 'Standard Allowance', computationType: 'PERCENT', basis: 'BASIC', value: 16.67, sortOrder: 3 },
  { name: 'Performance Bonus', computationType: 'PERCENT', basis: 'BASIC', value: 8.33, sortOrder: 4 },
  { name: 'Leave Travel Allowance', computationType: 'PERCENT', basis: 'BASIC', value: 8.33, sortOrder: 5 },
  { name: 'Fixed Allowance', computationType: 'REMAINDER', value: 0, sortOrder: 6 },
];

const PEOPLE = [
  { first: 'Dhanush', last: 'Moorthy', role: 'ADMIN' as const, position: 'HR Officer', dept: 'Human Resources', year: 2022, wage: 75000 },
  { first: 'Arman', last: 'Khan', role: 'EMPLOYEE' as const, position: 'Backend Engineer', dept: 'Engineering', year: 2022, wage: 60000 },
  { first: 'Priya', last: 'Sharma', role: 'EMPLOYEE' as const, position: 'Frontend Engineer', dept: 'Engineering', year: 2023, wage: 55000 },
  { first: 'Rahul', last: 'Verma', role: 'EMPLOYEE' as const, position: 'QA Engineer', dept: 'Engineering', year: 2023, wage: 45000 },
  { first: 'Ananya', last: 'Iyer', role: 'EMPLOYEE' as const, position: 'Product Designer', dept: 'Design', year: 2023, wage: 50000 },
  { first: 'Vikram', last: 'Singh', role: 'EMPLOYEE' as const, position: 'Accountant', dept: 'Finance', year: 2024, wage: 40000 },
  { first: 'Meera', last: 'Nair', role: 'EMPLOYEE' as const, position: 'Recruiter', dept: 'Human Resources', year: 2024, wage: 38000 },
  { first: 'Karthik', last: 'Rao', role: 'EMPLOYEE' as const, position: 'DevOps Engineer', dept: 'Engineering', year: 2025, wage: 65000 },
];

function dateOnly(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function at(day: Date, hours: number, minutes: number) {
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours, minutes),
  );
}

async function main() {
  console.log('Clearing existing data…');
  // Order matters: children before parents, or the FK restrictions bite.
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveAllocation.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.salaryComponent.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.loginIdSequence.deleteMany();
  await prisma.company.deleteMany();

  console.log('Creating company…');
  const company = await prisma.company.create({
    data: { name: 'Odoo India', code: COMPANY_CODE },
  });

  const leaveTypes = await Promise.all([
    prisma.leaveType.create({ data: { companyId: company.id, name: 'Paid Time off', isPaid: true } }),
    prisma.leaveType.create({
      data: { companyId: company.id, name: 'Sick Leave', isPaid: true, requiresAttachment: true },
    }),
    prisma.leaveType.create({ data: { companyId: company.id, name: 'Unpaid Leaves', isPaid: false } }),
  ]);
  const [paidLeave, sickLeave] = leaveTypes;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const serialByYear = new Map<number, number>();

  console.log('Creating users…');
  const users = [];
  for (const p of PEOPLE) {
    const serial = (serialByYear.get(p.year) ?? 0) + 1;
    serialByYear.set(p.year, serial);

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        loginId: loginIdFor(p.first, p.last, p.year, serial),
        email: `${p.first.toLowerCase()}.${p.last.toLowerCase()}@odooindia.test`,
        passwordHash,
        role: p.role,
        // Demo accounts are ready to sign in; only HR-created ones carry the flag.
        mustChangePassword: false,
        firstName: p.first,
        lastName: p.last,
        mobile: `+91 90000 0${String(serial).padStart(4, '0')}`,
        jobPosition: p.position,
        department: p.dept,
        location: 'Bengaluru',
        dateOfJoining: new Date(Date.UTC(p.year, 5, 1)),
        joiningYear: p.year,
        joiningSerial: serial,
        nationality: 'Indian',
        personalEmail: `${p.first.toLowerCase()}@example.com`,
        residingAddress: `${serial} MG Road, Bengaluru, Karnataka`,
        bankName: 'HDFC Bank',
        ifscCode: 'HDFC0001234',
        about: `${p.position} at Odoo India.`,
        salaryStructure: {
          create: {
            monthlyWage: p.wage,
            effectiveFrom: new Date(Date.UTC(p.year, 5, 1)),
            components: { create: COMPONENT_RULES },
          },
        },
        skills: { create: [{ name: 'Communication' }, { name: p.dept }] },
      },
    });
    users.push(user);
  }

  // Keep the sequence table consistent with what we inserted, so the first
  // employee created through the API doesn't collide with a seeded serial.
  for (const [year, lastSerial] of serialByYear) {
    await prisma.loginIdSequence.create({ data: { companyId: company.id, year, lastSerial } });
  }

  console.log('Creating attendance…');
  const today = dateOnly(new Date());
  const attendanceRows: Prisma.AttendanceCreateManyInput[] = [];

  for (const user of users) {
    for (let back = 0; back < 30; back += 1) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - back);

      const dow = day.getUTCDay();
      if (dow === 0 || dow === 6) continue; // weekends: no row at all

      // A deterministic pseudo-gap so some weekdays are genuinely absent.
      const slot = (user.id * 7 + back) % 11;
      if (slot === 0) continue; // absent — no row, so the card shows yellow

      const missingCheckout = slot === 1; // checked in, forgot to check out
      attendanceRows.push({
        userId: user.id,
        date: day,
        checkIn: at(day, 9, 30 + (slot % 5) * 6),
        checkOut: missingCheckout ? null : at(day, 18, 30 + (slot % 4) * 10),
      });
    }
  }
  await prisma.attendance.createMany({ data: attendanceRows });

  console.log('Creating leave allocations and requests…');
  const year = today.getUTCFullYear();
  for (const user of users) {
    await prisma.leaveAllocation.createMany({
      data: [
        { userId: user.id, leaveTypeId: paidLeave.id, year, allocatedDays: 24 },
        { userId: user.id, leaveTypeId: sickLeave.id, year, allocatedDays: 7 },
      ],
    });
  }

  const admin = users[0];
  const mkRange = (startOffset: number, days: number) => {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() + startOffset);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + days - 1);
    return { start, end };
  };

  // One of each status, so the approvals screen has something to show.
  const r1 = mkRange(-20, 2);
  const r2 = mkRange(-10, 1);
  const r3 = mkRange(5, 3);
  await prisma.leaveRequest.createMany({
    data: [
      {
        userId: users[1].id, leaveTypeId: paidLeave.id,
        startDate: r1.start, endDate: r1.end, days: 2,
        remarks: 'Family function', status: 'APPROVED',
        reviewedById: admin.id, reviewComment: 'Approved', reviewedAt: new Date(),
      },
      {
        userId: users[2].id, leaveTypeId: sickLeave.id,
        startDate: r2.start, endDate: r2.end, days: 1,
        remarks: 'Fever', status: 'REJECTED',
        reviewedById: admin.id, reviewComment: 'No certificate attached', reviewedAt: new Date(),
      },
      {
        userId: users[3].id, leaveTypeId: paidLeave.id,
        startDate: r3.start, endDate: r3.end, days: 3,
        remarks: 'Vacation', status: 'PENDING',
      },
      {
        userId: users[4].id, leaveTypeId: paidLeave.id,
        startDate: today, endDate: today, days: 1,
        // Approved and covering today, so this employee's card shows the
        // aeroplane icon rather than green or yellow.
        remarks: 'Personal', status: 'APPROVED',
        reviewedById: admin.id, reviewedAt: new Date(),
      },
    ],
  });

  console.log('\nSeed complete.');
  console.log(`  Company     : ${company.name} (${company.code})`);
  console.log(`  Users       : ${users.length}`);
  console.log(`  Attendance  : ${attendanceRows.length} rows`);
  console.log(`  Admin login : ${users[0].loginId}  /  ${DEMO_PASSWORD}`);
  console.log(`  Employee    : ${users[1].loginId}  /  ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
