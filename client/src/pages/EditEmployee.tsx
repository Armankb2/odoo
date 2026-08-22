import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type EmployeeCard } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { ErrorNote, Loading, PageHeader } from '../components/common';
import type { EmployeeFull } from '../components/ProfileTabs';

/**
 * Admin-only editor for an employee's details — "Admin can edit all employee
 * details" (PDF §3.3.2).
 *
 * The field list mirrors the server's ADMIN_EDITABLE allow-list. Anything
 * outside it is rejected server-side with a 403 naming the field, so the two
 * cannot drift silently: a field added here but not there fails loudly.
 *
 * Deliberately absent: Login ID, joining serial (system-generated, and editing
 * them would break the ID uniqueness invariant) and salary, which lives behind
 * its own admin-only endpoints on the Salary Info tab.
 */

const TEXT_FIELDS = [
  ['firstName', 'First Name', 'text'],
  ['lastName', 'Last Name', 'text'],
  ['email', 'Email', 'email'],
  ['mobile', 'Mobile', 'text'],
  ['jobPosition', 'Job Position', 'text'],
  ['department', 'Department', 'text'],
  ['location', 'Location', 'text'],
  ['dateOfJoining', 'Date of Joining', 'date'],
] as const;

const PRIVATE_FIELDS = [
  ['dateOfBirth', 'Date of Birth', 'date'],
  ['nationality', 'Nationality', 'text'],
  ['personalEmail', 'Personal Email', 'email'],
  ['residingAddress', 'Residing Address', 'text'],
] as const;

const BANK_FIELDS = [
  ['accountNumber', 'Account Number', 'text'],
  ['bankName', 'Bank Name', 'text'],
  ['ifscCode', 'IFSC Code', 'text'],
  ['panNo', 'PAN No', 'text'],
  ['uanNo', 'UAN No', 'text'],
  ['empCode', 'Emp Code', 'text'],
] as const;

const dateInput = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '');

export function EditEmployee() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const targetId = Number(id);

  const { data, error, loading, reload } = useAsync(
    () => api.get<{ employee: EmployeeFull }>(`/api/employees/${targetId}`),
    [targetId],
  );
  const colleagues = useAsync(
    () => api.get<{ employees: EmployeeCard[] }>('/api/employees'),
    [],
  );

  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const e = data.employee as unknown as Record<string, unknown>;
    setForm({
      ...Object.fromEntries(
        [...TEXT_FIELDS, ...PRIVATE_FIELDS, ...BANK_FIELDS].map(([k, , type]) => [
          k,
          type === 'date' ? dateInput(e[k] as string) : ((e[k] as string) ?? ''),
        ]),
      ),
      gender: (e.gender as string) ?? '',
      maritalStatus: (e.maritalStatus as string) ?? '',
      role: (e.role as string) ?? 'EMPLOYEE',
      managerId: e.manager ? String((e.manager as { id: number }).id) : '',
    });
  }, [data]);

  if (loading) return <Loading what="Loading employee" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const e = data.employee;
  const isSelf = user?.id === targetId;
  const set = (k: string) => (ev: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: ev.target.value }));

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setSaveError(null);
    setSaved(false);
    try {
      // Empty strings mean "clear this field"; the server maps them to null.
      // role is omitted when editing yourself — the server refuses it anyway.
      const payload: Record<string, unknown> = { ...form };
      if (isSelf) delete payload.role;
      await api.patch(`/api/employees/${targetId}`, payload);
      setSaved(true);
      reload();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setSaveError(null);
    try {
      await api.patch(`/api/employees/${targetId}/deactivate`, {});
      navigate('/employees');
    } catch (err) {
      setSaveError((err as Error).message);
    }
  };

  const renderFields = (fields: readonly (readonly [string, string, string])[]) =>
    fields.map(([key, label, type]) => (
      <div key={key} className="form-row">
        <label htmlFor={key}>{label}</label>
        <input id={key} type={type} value={form[key] ?? ''} onChange={set(key)} />
      </div>
    ));

  return (
    <section className="edit-employee-page">
      <PageHeader
        title={`Edit ${e.firstName} ${e.lastName}`}
        actions={
          <Link className="button" to={`/employees/${targetId}`}>
            Cancel
          </Link>
        }
      />

      <dl className="readonly-identity">
        <dt>Login ID</dt>
        <dd>{e.loginId}</dd>
      </dl>
      <p className="hint">
        The Login ID is generated by the system and cannot be changed. Changing the joining date
        does not regenerate it.
      </p>

      <form className="employee-form" onSubmit={onSubmit}>
        <fieldset>
          <legend>Job &amp; Contact</legend>
          {renderFields(TEXT_FIELDS)}

          <div className="form-row">
            <label htmlFor="managerId">Manager</label>
            <select id="managerId" value={form.managerId ?? ''} onChange={set('managerId')}>
              <option value="">— none —</option>
              {colleagues.data?.employees
                .filter((c) => c.id !== targetId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="role">Role</label>
            <select id="role" value={form.role ?? ''} onChange={set('role')} disabled={isSelf}>
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Admin / HR Officer</option>
            </select>
            {isSelf && <span className="hint">You cannot change your own role.</span>}
          </div>
        </fieldset>

        <fieldset>
          <legend>Private Info</legend>
          {renderFields(PRIVATE_FIELDS)}

          <div className="form-row">
            <label htmlFor="gender">Gender</label>
            <select id="gender" value={form.gender ?? ''} onChange={set('gender')}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="maritalStatus">Marital Status</label>
            <select
              id="maritalStatus"
              value={form.maritalStatus ?? ''}
              onChange={set('maritalStatus')}
            >
              <option value="">—</option>
              <option value="SINGLE">Single</option>
              <option value="MARRIED">Married</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </fieldset>

        <fieldset>
          <legend>Bank Details</legend>
          {renderFields(BANK_FIELDS)}
        </fieldset>

        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        {saved && <p className="notice">Changes saved.</p>}

        <div className="actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <Link className="button" to={`/employees/${targetId}`}>
            Cancel
          </Link>
        </div>
      </form>

      <section className="danger-zone">
        <h3>Deactivate</h3>
        <p className="hint">
          Deactivating keeps all attendance and time-off history but prevents the employee signing
          in. Accounts are never deleted.
        </p>
        <button type="button" disabled={isSelf} onClick={deactivate}>
          Deactivate this employee
        </button>
        {isSelf && <span className="hint">You cannot deactivate your own account.</span>}
      </section>

      <p className="hint">
        Salary is edited on the Salary Info tab of this employee&apos;s profile.
      </p>
    </section>
  );
}
