import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { homeFor } from '../components/ProtectedRoute';
import type { Role } from '../lib/api';

/**
 * Sign-up for the single Dayflow company.
 *
 * Two steps in one form. The email has to be verified with a six-digit code
 * before the account is created (PDF §3.1.1) — the Sign Up button stays
 * disabled until a code has been sent, and the server checks the code again
 * regardless of what the form allows.
 *
 * No company name or code is asked for: there is only one company and its
 * details are fixed server-side. The caller picks their own role, and the
 * server takes that at face value.
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
    otp: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Verification state, kept separate from the form fields.
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpNote, setOtpNote] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const sendOtp = async () => {
    const email = form.email.trim();
    if (!email) {
      setError('Enter your email first');
      return;
    }
    setOtpBusy(true);
    setError(null);
    setOtpNote(null);
    try {
      const res = await api.post<{ delivered: boolean }>('/api/auth/send-otp', { email });
      setOtpSent(true);
      setOtpNote(
        res.delivered
          ? `Code sent to ${email}. Check your inbox — and your spam folder.`
          : // SMTP is not configured on this server. Say so plainly rather than
            // leaving someone waiting for an email that is not coming.
            'Email is not configured on the server, so the code was printed to the server console instead.',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOtpBusy(false);
    }
  };

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
      await api.post('/api/auth/signup', { ...payload, email: payload.email.trim() });
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
        <div className="field-with-action">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => {
              set('email')(e);
              // The code was issued for the old address, so changing the email
              // has to invalidate the step rather than silently verify the
              // wrong mailbox.
              if (otpSent) {
                setOtpSent(false);
                setOtpNote(null);
                setForm((f) => ({ ...f, otp: '' }));
              }
            }}
          />
          <button type="button" onClick={sendOtp} disabled={otpBusy || !form.email.trim()}>
            {otpBusy ? 'Sending…' : otpSent ? 'Resend code' : 'Send code'}
          </button>
        </div>

        {otpNote && <p className="notice">{otpNote}</p>}

        {otpSent && (
          <>
            <label htmlFor="otp">Enter OTP</label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="6-digit code"
              value={form.otp}
              onChange={set('otp')}
            />
          </>
        )}

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

        <button type="submit" disabled={busy || !otpSent}>
          {busy ? 'Creating…' : 'Sign Up'}
        </button>
        {!otpSent && <p className="hint">Verify your email to enable sign up.</p>}

        <p className="auth-alt">
          Already have an account? <Link to="/signin">Sign In</Link>
        </p>
      </form>
    </div>
  );
}
