import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { homeFor } from '../components/ProtectedRoute';
import type { Role } from '../lib/api';

/**
 * Sign-up for the single Dayflow company.
 *
 * No company name or code is asked for — there is only one company and its
 * details are fixed server-side. The caller picks their own role; the server
 * takes that at face value, so anyone signing up can become an Admin.
 */
export function SignUp() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'EMPLOYEE' as Role,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { confirmPassword, ...payload } = form;
      await api.post('/api/auth/signup', payload);
      await refresh();
      navigate(homeFor(form.role), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={onSubmit}>
        <h1>Sign Up</h1>

        <label htmlFor="role">I am signing up as</label>
        <select id="role" name="role" required value={form.role} onChange={set('role')}>
          <option value="EMPLOYEE">Employee</option>
          <option value="ADMIN">Admin / HR</option>
        </select>

        <label htmlFor="name">Name</label>
        <input id="name" required value={form.name} onChange={set('name')} />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" required value={form.email} onChange={set('email')} />

        <label htmlFor="phone">Phone</label>
        <input id="phone" value={form.phone} onChange={set('phone')} />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
        />

        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Sign Up'}
        </button>

        <p className="auth-alt">
          Already have an account? <Link to="/signin">Sign In</Link>
        </p>
      </form>
    </div>
  );
}
