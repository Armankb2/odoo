import type { Role } from '@prisma/client';
import { forbidden } from '../lib/errors';

/**
 * Field-level access control.
 *
 * Route-level roles answer "may you call this endpoint"; this answers "which
 * fields may you see and change once you are in". The spec demands the
 * distinction:
 *
 *   - "Employees edit limited fields (address, phone, profile picture). Admin
 *      can edit all employee details."   (PDF §3.3.2)
 *   - "Payroll data is read-only for employees."   (PDF §3.6.1)
 *
 * Note on salary: an employee CAN read their own salary — PDF §2 lists "views
 * salary details" among an employee's abilities and §3.6.1 makes it read-only
 * rather than hidden. `canViewSalary` below implements exactly that. This
 * comment used to cite a wireframe line, "Salary Info tab should only be
 * visible to Admin", which reads as admin-only and contradicts the PDF; the
 * wireframe has since been deleted and the PDF governs.
 *
 * The rule that matters: this is applied server-side, to an allow-list. Never
 * trust the set of fields the client chose to send, and never rely on the UI
 * hiding something — the API is reachable directly.
 */

/** Fields an employee may change on their own record. Everything else — role,
 *  salary, joining date, Login ID — is admin territory. */
const EMPLOYEE_EDITABLE = [
  'mobile',
  'avatarUrl',
  'residingAddress',
  'personalEmail',
  'about',
  'whatILoveAboutJob',
  'interestsAndHobbies',
] as const;

/** Fields an admin may change on anyone's record. Deliberately excludes
 *  loginId, joiningYear and joiningSerial: those are system-generated and
 *  editing them would break the uniqueness invariant behind the ID format. */
const ADMIN_EDITABLE = [
  ...EMPLOYEE_EDITABLE,
  'firstName',
  'lastName',
  'email',
  'jobPosition',
  'department',
  'location',
  'managerId',
  'dateOfJoining',
  'dateOfBirth',
  'nationality',
  'gender',
  'maritalStatus',
  'accountNumber',
  'bankName',
  'ifscCode',
  'panNo',
  'uanNo',
  'empCode',
  'role',
  'isActive',
] as const;

/** Never returned by the API to anybody. */
const ALWAYS_HIDDEN = ['passwordHash'] as const;

export function editableFieldsFor(role: Role, isSelf: boolean): readonly string[] {
  if (role === 'ADMIN') return ADMIN_EDITABLE;
  return isSelf ? EMPLOYEE_EDITABLE : [];
}

/**
 * Strips a patch down to what the actor is allowed to change, and refuses
 * loudly if they tried to change something else.
 *
 * Rejecting rather than silently dropping is deliberate: a silent drop means
 * an employee who tries to set their own salary gets a 200 and believes it
 * worked.
 */
export function filterPatch<T extends Record<string, unknown>>(
  patch: T,
  role: Role,
  isSelf: boolean,
): Partial<T> {
  const allowed = editableFieldsFor(role, isSelf);
  const rejected = Object.keys(patch).filter((k) => !allowed.includes(k));

  if (rejected.length > 0) {
    throw forbidden(`You may not edit: ${rejected.join(', ')}`);
  }

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) out[key] = patch[key];
  return out as Partial<T>;
}

/**
 * Salary visibility.
 *
 * An employee may view their OWN salary — "Payroll data is read-only for
 * employees" (PDF §3.6.1) — but nobody else's. Admins may view anyone's.
 * Another employee's salary is omitted from the payload entirely rather than
 * hidden in the UI: anything sent to the browser is readable.
 *
 * Note this is *view* only. There is no path by which an employee can change
 * salary: it is absent from both edit allow-lists below, and every salary
 * write endpoint is gated on requireRole('ADMIN').
 */
export function canViewSalary(actor: { id: number; role: Role }, targetUserId: number): boolean {
  return actor.role === 'ADMIN' || actor.id === targetUserId;
}

export function stripHiddenFields<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out = { ...row } as Record<string, unknown>;
  for (const f of ALWAYS_HIDDEN) delete out[f];
  return out as Partial<T>;
}
