import { prisma } from '../lib/prisma';
import { conflict, forbidden, notFound, validation } from '../lib/errors';
import { dateOnly, inclusiveDayCount } from '../lib/dates';
import type { Role } from '@prisma/client';

/**
 * Time Off.
 *
 * Balances are computed, never stored as a running counter. A counter would
 * need updating on approve, reject, cancel and edit — and one missed path
 * leaves a permanently wrong "24 Days Available" on screen with no way for the
 * user to tell it is wrong.
 */

export function listLeaveTypes(companyId: number) {
  return prisma.leaveType.findMany({ where: { companyId }, orderBy: { id: 'asc' } });
}

/** Powers the balance tiles: "Paid time Off — 24 Days Available". */
export async function balanceFor(userId: number, year = new Date().getUTCFullYear()) {
  const [allocations, approved] = await Promise.all([
    prisma.leaveAllocation.findMany({
      where: { userId, year },
      include: { leaveType: true },
      orderBy: { leaveTypeId: 'asc' },
    }),
    prisma.leaveRequest.groupBy({
      by: ['leaveTypeId'],
      where: {
        userId,
        status: 'APPROVED',
        startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      _sum: { days: true },
    }),
  ]);

  const usedByType = new Map(approved.map((a) => [a.leaveTypeId, Number(a._sum.days ?? 0)]));

  return allocations.map((a) => {
    const used = usedByType.get(a.leaveTypeId) ?? 0;
    const allocated = Number(a.allocatedDays);
    return {
      leaveTypeId: a.leaveTypeId,
      name: a.leaveType.name,
      isPaid: a.leaveType.isPaid,
      requiresAttachment: a.leaveType.requiresAttachment,
      allocatedDays: allocated,
      usedDays: used,
      remainingDays: allocated - used,
    };
  });
}

export async function listRequests(
  actor: { id: number; companyId: number; role: Role },
  opts: { scope?: 'me' | 'all'; status?: 'PENDING' | 'APPROVED' | 'REJECTED'; search?: string } = {},
) {
  // An employee asking for scope=all is quietly narrowed to their own records
  // rather than refused — the wireframe gives them the same screen, just with
  // less in it.
  const scope = actor.role === 'ADMIN' ? (opts.scope ?? 'all') : 'me';
  const term = opts.search?.trim();

  return prisma.leaveRequest.findMany({
    where: {
      ...(scope === 'me' ? { userId: actor.id } : { user: { companyId: actor.companyId } }),
      ...(opts.status ? { status: opts.status } : {}),
      ...(term
        ? {
            user: {
              companyId: actor.companyId,
              OR: [{ firstName: { contains: term } }, { lastName: { contains: term } }],
            },
          }
        : {}),
    },
    include: {
      leaveType: { select: { id: true, name: true, isPaid: true } },
      user: { select: { id: true, firstName: true, lastName: true, loginId: true, avatarUrl: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  });
}

export async function createRequest(
  actor: { id: number; companyId: number; role: Role },
  input: {
    userId?: number;
    leaveTypeId: number;
    startDate: Date;
    endDate: Date;
    days?: number;
    remarks?: string;
    attachmentUrl?: string;
  },
) {
  // Only an admin may file on someone else's behalf; the wireframe's request
  // form has an Employee field, which is only meaningful for HR.
  const targetUserId = input.userId ?? actor.id;
  if (targetUserId !== actor.id && actor.role !== 'ADMIN') {
    throw forbidden('You can only request time off for yourself');
  }

  const start = dateOnly(input.startDate);
  const end = dateOnly(input.endDate);
  if (end < start) throw validation('End date cannot be before the start date');

  const leaveType = await prisma.leaveType.findFirst({
    where: { id: input.leaveTypeId, companyId: actor.companyId },
  });
  if (!leaveType) throw notFound('Leave type not found');

  if (leaveType.requiresAttachment && !input.attachmentUrl) {
    throw validation(`${leaveType.name} requires a supporting document`);
  }

  const days = input.days ?? inclusiveDayCount(start, end);
  if (days <= 0) throw validation('Days must be greater than zero');

  // Overlap check. Neither requirements source mentions it, but without it an
  // employee can book the same week twice and the balance silently
  // double-counts.
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId: targetUserId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlapping) {
    throw conflict('You already have a request covering some of those dates');
  }

  // Paid types are checked against the balance; unpaid leave has no ceiling,
  // which is the only thing that makes the paid/unpaid distinction mean
  // anything.
  if (leaveType.isPaid) {
    const balances = await balanceFor(targetUserId, start.getUTCFullYear());
    const b = balances.find((x) => x.leaveTypeId === leaveType.id);
    if (!b) throw validation(`No ${leaveType.name} allocation exists for that year`);
    if (days > b.remainingDays) {
      throw validation(
        `Only ${b.remainingDays} day(s) of ${leaveType.name} remain, but ${days} were requested`,
      );
    }
  }

  return prisma.leaveRequest.create({
    data: {
      userId: targetUserId,
      leaveTypeId: leaveType.id,
      startDate: start,
      endDate: end,
      days,
      remarks: input.remarks,
      attachmentUrl: input.attachmentUrl,
      status: 'PENDING',
    },
    include: { leaveType: true },
  });
}

async function decide(
  actor: { id: number; companyId: number },
  requestId: number,
  status: 'APPROVED' | 'REJECTED',
  comment?: string,
) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, user: { companyId: actor.companyId } },
    include: { leaveType: true },
  });
  if (!request) throw notFound('Leave request not found');

  // Deciding twice would let an approval be silently flipped, and — for
  // approvals — would let the balance be spent, refunded and spent again.
  if (request.status !== 'PENDING') {
    throw conflict(`This request has already been ${request.status.toLowerCase()}`);
  }

  // Re-check the balance at approval time, not just at request time: several
  // pending requests can each fit individually but not together.
  if (status === 'APPROVED' && request.leaveType.isPaid) {
    const balances = await balanceFor(request.userId, request.startDate.getUTCFullYear());
    const b = balances.find((x) => x.leaveTypeId === request.leaveTypeId);
    if (!b || Number(request.days) > b.remainingDays) {
      throw conflict(
        `Cannot approve: only ${b?.remainingDays ?? 0} day(s) of ${request.leaveType.name} remain`,
      );
    }
  }

  return prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status, reviewedById: actor.id, reviewComment: comment, reviewedAt: new Date() },
    include: { leaveType: true, user: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export const approveRequest = (
  actor: { id: number; companyId: number },
  id: number,
  comment?: string,
) => decide(actor, id, 'APPROVED', comment);

export const rejectRequest = (
  actor: { id: number; companyId: number },
  id: number,
  comment?: string,
) => decide(actor, id, 'REJECTED', comment);

/** An employee may withdraw their own request while it is still pending. */
export async function cancelRequest(actor: { id: number; role: Role }, requestId: number) {
  const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
  if (!request) throw notFound('Leave request not found');
  if (request.userId !== actor.id && actor.role !== 'ADMIN') {
    throw forbidden('You can only cancel your own requests');
  }
  if (request.status !== 'PENDING') {
    throw conflict('Only pending requests can be cancelled');
  }
  return prisma.leaveRequest.delete({ where: { id: requestId } });
}

/** HR grants or adjusts an allocation — the wireframe's "Allocation" sub-nav. */
export async function upsertAllocation(
  companyId: number,
  input: { userId: number; leaveTypeId: number; year: number; allocatedDays: number },
) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, companyId },
    select: { id: true },
  });
  if (!user) throw notFound('Employee not found');

  return prisma.leaveAllocation.upsert({
    where: {
      userId_leaveTypeId_year: {
        userId: input.userId,
        leaveTypeId: input.leaveTypeId,
        year: input.year,
      },
    },
    update: { allocatedDays: input.allocatedDays },
    create: input,
  });
}
