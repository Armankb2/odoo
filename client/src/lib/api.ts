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

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: isForm || body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects for genuine network failures, not HTTP errors.
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Is the API running?');
  }

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

    // The API always answers errors as { error: { code, message } }. A 5xx with
    // no body at all did not come from the API — in development it is the Vite
    // proxy failing to reach the server on :4000, which it reports as an empty
    // 500. "Request failed (500)" sends you hunting through server code for a
    // bug that is not there; say what it actually is.
    if (!e && res.status >= 500) {
      throw new ApiError(
        res.status,
        'SERVER_UNREACHABLE',
        'Cannot reach the API server. Start it with `npm run dev` in server/.',
      );
    }

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

/** One cell of the employee attendance calendar. `status` is the only thing
 *  that decides the colour; the stylesheet hooks onto it. */
export type DayStatus = 'present' | 'absent' | 'timeoff' | 'off' | 'future';

export interface AttendanceDay {
  date: string;
  day: number;
  /** 0 = Sunday … 6 = Saturday, in UTC, matching the server's date columns. */
  weekday: number;
  status: DayStatus;
  checkIn: string | null;
  checkOut: string | null;
  workHours: string | null;
  missingCheckOut: boolean;
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
