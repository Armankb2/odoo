/**
 * Thin fetch wrapper. `credentials: 'include'` so the httpOnly auth cookie
 * travels; the Vite proxy keeps everything same-origin in development.
 *
 * The server always answers errors as { error: { code, message } }, so this
 * unwraps that into a real Error carrying the code — callers can branch on
 * `err.code` instead of parsing messages.
 */

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: isForm || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const e = payload?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'UNKNOWN',
      e?.message ?? `Request failed (${res.status})`,
      e?.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
};

// ---------------------------------------------------------------- types

export type Role = 'ADMIN' | 'EMPLOYEE';
export type CardStatus = 'present' | 'leave' | 'absent';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CurrentUser {
  id: number;
  loginId: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  company: { id: number; name: string; code: string; logoUrl: string | null };
}

export interface EmployeeCard {
  id: number;
  loginId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobPosition: string | null;
  department: string | null;
  avatarUrl: string | null;
  role: Role;
  status: CardStatus;
}

export interface AttendanceRecord {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workHours: string;
  extraHours: string;
  missingCheckOut: boolean;
}

export interface LeaveBalance {
  leaveTypeId: number;
  name: string;
  isPaid: boolean;
  requiresAttachment: boolean;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface LeaveRequest {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  days: string;
  remarks: string | null;
  attachmentUrl: string | null;
  status: LeaveStatus;
  reviewComment: string | null;
  leaveType: { id: number; name: string; isPaid: boolean };
  user: { id: number; firstName: string; lastName: string; loginId: string };
  reviewedBy: { id: number; firstName: string; lastName: string } | null;
}
