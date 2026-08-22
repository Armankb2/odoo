/**
 * Date helpers for attendance and leave.
 *
 * `Attendance.date`, `LeaveRequest.startDate` and `endDate` are `@db.Date`
 * columns — calendar days, not instants. Prisma reads and writes them as
 * JavaScript Dates pinned to UTC midnight, so every comparison here works in
 * UTC to match. Mixing local-time construction with these values is the
 * classic source of "attendance shows on the wrong day" bugs.
 *
 * Known limitation, inherited from the requirements: neither the PDF nor the
 * wireframe defines a company timezone or a holiday calendar, so "today" is
 * the server's UTC day and working days are derived purely from
 * workingDaysPerWeek.
 */

/** Strips the time, returning UTC midnight of the same calendar day. */
export function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function today(): Date {
  return dateOnly(new Date());
}

/** Inclusive first day / exclusive last day of a `YYYY-MM` month. */
export function monthRange(month: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`Invalid month "${month}", expected YYYY-MM`);
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error(`Invalid month "${month}"`);
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

export function currentMonthKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Whole days between two dates, inclusive of both ends. */
export function inclusiveDayCount(start: Date, end: Date): number {
  const ms = dateOnly(end).getTime() - dateOnly(start).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Working days in a range, from `workingDaysPerWeek`.
 *
 * 5 → Mon-Fri, 6 → Mon-Sat, otherwise every day. Crude, but it is the only
 * basis the requirements provide: there is no holiday calendar anywhere in
 * either source.
 */
export function countWorkingDays(start: Date, endExclusive: Date, workingDaysPerWeek: number): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor < endExclusive) {
    const dow = cursor.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWorking =
      workingDaysPerWeek >= 7 ? true : workingDaysPerWeek === 6 ? dow !== 0 : dow !== 0 && dow !== 6;
    if (isWorking) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * Work and overtime minutes for one attendance row.
 *
 * A row with no check-out is valid — the employee forgot, or is still in the
 * office — and reports zero rather than a negative or a guess.
 */
export function computeWorkMinutes(
  checkIn: Date | null,
  checkOut: Date | null,
  breakMinutes: number,
  standardDayMinutes: number,
): { workMinutes: number; extraMinutes: number } {
  if (!checkIn || !checkOut) return { workMinutes: 0, extraMinutes: 0 };
  const gross = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60_000);
  const workMinutes = Math.max(0, gross - breakMinutes);
  return { workMinutes, extraMinutes: Math.max(0, workMinutes - standardDayMinutes) };
}

/** Minutes → "HH:MM", the format the wireframe shows (09:00, 01:00). */
export function formatHhMm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
