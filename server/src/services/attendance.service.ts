import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { conflict, notFound } from '../lib/errors';
import {
  computeWorkMinutes,
  countWorkingDays,
  dateOnly,
  formatHhMm,
  isWorkingDay,
  monthRange,
  toDateKey,
  today,
} from '../lib/dates';

/**
 * Attendance.
 *
 * Work hours and extra hours are computed on read, never stored — they depend
 * on the employee's break time and the company's standard day, both of which
 * can change. A stored copy would be wrong the moment either does.
 */

async function scheduleFor(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      companyId: true,
      salaryStructure: { select: { breakMinutes: true, workingDaysPerWeek: true } },
      company: { select: { standardDayMinutes: true, workingDaysPerWeek: true } },
    },
  });
  if (!user) throw notFound('Employee not found');
  return {
    breakMinutes: user.salaryStructure?.breakMinutes ?? 60,
    workingDaysPerWeek:
      user.salaryStructure?.workingDaysPerWeek ?? user.company.workingDaysPerWeek,
    standardDayMinutes: user.company.standardDayMinutes,
  };
}

/**
 * Check in for today.
 *
 * Relies on the `@@unique([userId, date])` constraint rather than a
 * read-then-write check: two rapid clicks would both pass an existence check
 * and the second insert would still fail, so the constraint is the real guard
 * and P2002 is translated into a friendly 409.
 */
export async function checkIn(userId: number) {
  const day = today();
  try {
    return await prisma.attendance.create({
      data: { userId, date: day, checkIn: new Date() },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('You have already checked in today');
    }
    throw err;
  }
}

export async function checkOut(userId: number) {
  const day = today();
  const row = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: day } },
  });
  if (!row) throw conflict('You have not checked in today');
  if (row.checkOut) throw conflict('You have already checked out today');

  return prisma.attendance.update({
    where: { id: row.id },
    data: { checkOut: new Date() },
  });
}

/** Drives the check-in widget: the red/green dot and the "Since HH:MM" label. */
export async function todayStatus(userId: number) {
  const row = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today() } },
  });
  return {
    checkedIn: Boolean(row?.checkIn && !row?.checkOut),
    checkIn: row?.checkIn ?? null,
    checkOut: row?.checkOut ?? null,
    completed: Boolean(row?.checkOut),
  };
}

function decorate(
  rows: { date: Date; checkIn: Date | null; checkOut: Date | null }[],
  s: { breakMinutes: number; standardDayMinutes: number },
) {
  return rows.map((r) => {
    const { workMinutes, extraMinutes } = computeWorkMinutes(
      r.checkIn,
      r.checkOut,
      s.breakMinutes,
      s.standardDayMinutes,
    );
    return {
      date: toDateKey(r.date),
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      workMinutes,
      extraMinutes,
      workHours: formatHhMm(workMinutes),
      extraHours: formatHhMm(extraMinutes),
      // Surfaced explicitly so the UI can flag it rather than silently
      // rendering 00:00 as though the person worked nothing.
      missingCheckOut: Boolean(r.checkIn && !r.checkOut),
    };
  });
}

/**
 * The colour of one calendar cell.
 *
 *   present  green   an attendance row exists for the day
 *   absent   red     a working day with neither attendance nor approved leave
 *   timeoff  yellow  covered by an APPROVED leave request
 *   off      grey    not a working day — always Sunday, plus Saturday on a
 *                    five-day week
 *   future   blank   later than today; nothing has happened yet, and painting
 *                    it red would report the rest of the month as absence
 */
export type DayStatus = 'present' | 'absent' | 'timeoff' | 'off' | 'future';

/** Every date key an approved leave request covers, clipped to the month. */
function leaveDayKeys(
  leaves: { startDate: Date; endDate: Date }[],
  start: Date,
  endExclusive: Date,
): Set<string> {
  const keys = new Set<string>();
  for (const l of leaves) {
    const cursor = new Date(Math.max(dateOnly(l.startDate).getTime(), start.getTime()));
    const last = dateOnly(l.endDate);
    while (cursor <= last && cursor < endExclusive) {
      keys.add(toDateKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return keys;
}

/**
 * An employee's own month: the three summary tiles, the row detail, and one
 * entry per calendar day for the month grid.
 *
 * Precedence is deliberate. An attendance row wins over everything below it,
 * because if someone actually checked in that day, saying so is the truthful
 * thing to do even on a Sunday. A non-working day then beats leave, so a leave
 * request spanning a weekend does not paint the Sunday yellow — the
 * requirement is that Sunday reads grey.
 */
export async function myMonth(userId: number, month: string) {
  const { start, end } = monthRange(month);
  const s = await scheduleFor(userId);

  const [rows, approvedLeave] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, date: { gte: start, lt: end } },
      orderBy: { date: 'desc' },
    }),
    prisma.leaveRequest.findMany({
      where: { userId, status: 'APPROVED', startDate: { lt: end }, endDate: { gte: start } },
      select: { days: true, startDate: true, endDate: true },
    }),
  ]);

  const leavesCount = approvedLeave.reduce((sum, l) => sum + Number(l.days), 0);

  const records = decorate(rows, s);
  const byDate = new Map(records.map((r) => [r.date, r]));
  const onLeave = leaveDayKeys(approvedLeave, start, end);
  const todayKey = toDateKey(today());

  const days: {
    date: string;
    day: number;
    weekday: number;
    status: DayStatus;
    checkIn: Date | null;
    checkOut: Date | null;
    workHours: string | null;
    missingCheckOut: boolean;
  }[] = [];

  const cursor = new Date(start);
  while (cursor < end) {
    const key = toDateKey(cursor);
    const record = byDate.get(key);

    let status: DayStatus;
    if (record) status = 'present';
    else if (!isWorkingDay(cursor, s.workingDaysPerWeek)) status = 'off';
    else if (onLeave.has(key)) status = 'timeoff';
    else if (key > todayKey) status = 'future';
    else status = 'absent';

    days.push({
      date: key,
      day: cursor.getUTCDate(),
      weekday: cursor.getUTCDay(),
      status,
      checkIn: record?.checkIn ?? null,
      checkOut: record?.checkOut ?? null,
      workHours: record?.workHours ?? null,
      missingCheckOut: record?.missingCheckOut ?? false,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    month,
    records,
    days,
    summary: {
      daysPresent: rows.length,
      leavesCount,
      totalWorkingDays: countWorkingDays(start, end, s.workingDaysPerWeek),
    },
  };
}

/** Admin view: every employee for one day, as the wireframe's list. */
export async function companyDay(companyId: number, date: Date, search?: string) {
  const day = dateOnly(date);
  const term = search?.trim();

  const users = await prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      ...(term
        ? {
            OR: [
              { firstName: { contains: term } },
              { lastName: { contains: term } },
              { loginId: { contains: term } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      loginId: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      salaryStructure: { select: { breakMinutes: true } },
      attendances: { where: { date: day } },
    },
    orderBy: { firstName: 'asc' },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { standardDayMinutes: true },
  });

  return {
    date: toDateKey(day),
    records: users.map((u) => {
      const row = u.attendances[0];
      const { workMinutes, extraMinutes } = computeWorkMinutes(
        row?.checkIn ?? null,
        row?.checkOut ?? null,
        u.salaryStructure?.breakMinutes ?? 60,
        company?.standardDayMinutes ?? 480,
      );
      return {
        userId: u.id,
        loginId: u.loginId,
        name: `${u.firstName} ${u.lastName}`,
        avatarUrl: u.avatarUrl,
        checkIn: row?.checkIn ?? null,
        checkOut: row?.checkOut ?? null,
        workHours: formatHhMm(workMinutes),
        extraHours: formatHhMm(extraMinutes),
        present: Boolean(row),
      };
    }),
  };
}

/**
 * The employee-card status icons: 🟢 present, ✈️ on leave, 🟡 absent.
 *
 * Derived, never stored, and resolved for the whole list in two queries rather
 * than per-card — an N+1 here would be one query per employee on the landing
 * page.
 *
 * Leave wins over attendance: someone on approved leave who also checked in
 * still reads as "on leave", matching the wireframe's own wording that yellow
 * means "has not applied time off and is absent".
 */
export async function statusForUsers(userIds: number[], when: Date = today()) {
  const day = dateOnly(when);
  if (userIds.length === 0) return new Map<number, 'present' | 'leave' | 'absent'>();

  const [attendance, leaves] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId: { in: userIds }, date: day },
      select: { userId: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: 'APPROVED',
        startDate: { lte: day },
        endDate: { gte: day },
      },
      select: { userId: true },
    }),
  ]);

  const present = new Set(attendance.map((a) => a.userId));
  const onLeave = new Set(leaves.map((l) => l.userId));

  const out = new Map<number, 'present' | 'leave' | 'absent'>();
  for (const id of userIds) {
    out.set(id, onLeave.has(id) ? 'leave' : present.has(id) ? 'present' : 'absent');
  }
  return out;
}

/**
 * Payable days for a month.
 *
 * The wireframe: "Attendance data serves as the basis for payslip generation…
 * Any unpaid leave or missing attendance days should automatically reduce the
 * number of payable days."
 *
 * So: working days, minus unpaid leave, minus working days with no attendance
 * and no approved leave. Paid leave does not reduce the count. No payslip
 * document is produced — that remains out of scope.
 */
export async function payableDays(userId: number, month: string) {
  const { start, end } = monthRange(month);
  const s = await scheduleFor(userId);

  const [attendance, leaves] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, date: { gte: start, lt: end } },
      select: { date: true },
    }),
    prisma.leaveRequest.findMany({
      where: { userId, status: 'APPROVED', startDate: { lt: end }, endDate: { gte: start } },
      select: { days: true, leaveType: { select: { isPaid: true } } },
    }),
  ]);

  const workingDays = countWorkingDays(start, end, s.workingDaysPerWeek);
  const unpaidLeaveDays = leaves
    .filter((l) => !l.leaveType.isPaid)
    .reduce((sum, l) => sum + Number(l.days), 0);
  const paidLeaveDays = leaves
    .filter((l) => l.leaveType.isPaid)
    .reduce((sum, l) => sum + Number(l.days), 0);

  const covered = attendance.length + paidLeaveDays + unpaidLeaveDays;
  const missingDays = Math.max(0, workingDays - covered);

  return {
    month,
    workingDays,
    daysPresent: attendance.length,
    paidLeaveDays,
    unpaidLeaveDays,
    missingDays,
    payableDays: Math.max(0, workingDays - unpaidLeaveDays - missingDays),
  };
}
