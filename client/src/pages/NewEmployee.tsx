import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader } from '../components/common';

interface Created {
  employee: { id: number; loginId: string; email: string; role: string };
  tempPassword: string;
}

/**
 * Admin-only. The server generates both the Login ID and the first password;
 * neither is an input here.
 */
export function NewEmployee() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    dateOfJoining: new Date().toISOString().slice(0, 10),
    role: 'EMPLOYEE',
    jobPosition: '',
    department: '',
    location: '',
    mobile: '',
  });
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      setCreated(await api.post<Created>('/api/employees', payload));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // The temporary password is returned exactly once, at creation. There is no
  // endpoint to read it back, so it has to be shown until HR dismisses it.
  if (created) {
    return (
      <section className="new-employee-page">
        <PageHeader title="Employee created" />
        <dl className="credentials">
          <dt>Login ID</dt>
          <dd>{created.employee.loginId}</dd>
          <dt>Temporary password</dt>
          <dd>{created.tempPassword}</dd>
        </dl>
        <p className="notice">
          Share these with the employee now — the password is shown only once and cannot be
          retrieved later. They will be asked to change it at first sign-in.
        </p>
        <div className="actions">
          <Link className="button" to={`/employees/${created.employee.id}`}>
            View profile
          </Link>
          <button type="button" onClick={() => navigate('/employees')}>
            Back to employees
          </button>
          <button type="button" onClick={() => setCreated(null)}>
            Add another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="new-employee-page">
      <PageHeader title="New Employee" />
      <form className="employee-form" onSubmit={onSubmit}>
        <label htmlFor="firstName">First Name</label>
        <input id="firstName" required value={form.firstName} onChange={set('firstName')} />

        <label htmlFor="lastName">Last Name</label>
        <input id="lastName" required value={form.lastName} onChange={set('lastName')} />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" required value={form.email} onChange={set('email')} />

        <label htmlFor="dateOfJoining">Date of Joining</label>
        {/* Drives the year segment and the serial in the generated Login ID. */}
        <input
          id="dateOfJoining"
          type="date"
          required
          value={form.dateOfJoining}
          onChange={set('dateOfJoining')}
        />

        <label htmlFor="role">Role</label>
        <select id="role" value={form.role} onChange={set('role')}>
          <option value="EMPLOYEE">Employee</option>
          <option value="ADMIN">Admin / HR Officer</option>
        </select>

        <label htmlFor="jobPosition">Job Position</label>
        <input id="jobPosition" value={form.jobPosition} onChange={set('jobPosition')} />

        <label htmlFor="department">Department</label>
        <input id="department" value={form.department} onChange={set('department')} />

        <label htmlFor="location">Location</label>
        <input id="location" value={form.location} onChange={set('location')} />

        <label htmlFor="mobile">Mobile</label>
        <input id="mobile" value={form.mobile} onChange={set('mobile')} />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create Employee'}
        </button>
      </form>
    </section>
  );
}
