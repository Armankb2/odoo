import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

/**
 * Company registration — NOT employee self-service.
 *
 * Per the wireframe: "Normal user cannot register." This creates the company
 * and its first admin. Every other account is created by that admin from the
 * Employees screen.
 */
export function SignUp() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '',
    companyCode: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
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
      await api.post('/api/auth/signup', { ...payload, companyCode: payload.companyCode.toUpperCase() });
      await refresh();
      navigate('/employees', { replace: true });
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

        <label htmlFor="companyName">Company Name</label>
        <input id="companyName" required value={form.companyName} onChange={set('companyName')} />

        <label htmlFor="companyCode">Company Code</label>
        {/* Two letters — becomes the Login ID prefix, e.g. OI in OIJODO20220001. */}
        <input
          id="companyCode"
          required
          maxLength={2}
          minLength={2}
          pattern="[A-Za-z]{2}"
          title="Exactly two letters"
          value={form.companyCode}
          onChange={set('companyCode')}
        />

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
