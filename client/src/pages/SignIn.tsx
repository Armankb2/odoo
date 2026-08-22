import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { homeFor } from '../components/ProtectedRoute';
import type { Role } from '../lib/api';

/**
 * Sign-in, in two steps.
 *
 * Credentials first, then a six-digit code mailed to the address on the
 * account (PDF §3.1.1). The code step only appears once the password has been
 * accepted, because the server refuses to send a code until then — that keeps
 * this from being a way to mailbomb an address or to probe which accounts
 * exist.
 */
export function SignIn() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const credentials = () => ({ identifier: identifier.trim(), password, role });

  /** Step 1 — the server checks the password, then mails the code. */
  const sendCode = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your Login ID / email and password first');
      return;
    }
    setSending(true);
    setError(null);
    setNote(null);
    try {
      const res = await api.post<{ delivered: boolean; sentTo: string }>(
        '/api/auth/send-otp',
        credentials(),
      );
      setCodeSent(true);
      setNote(
        res.delivered
          ? `Code sent to ${res.sentTo}. Check your inbox — and your spam folder.`
          : 'Email is not configured on this server, so the code was printed to the server console.',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  /** Step 2 — same credentials, plus the code. */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password, role, otp);
      navigate(homeFor(role), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Changing any credential invalidates the code that was issued for it.
  const resetCodeStep = () => {
    if (!codeSent) return;
    setCodeSent(false);
    setNote(null);
    setOtp('');
  };

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={onSubmit}>
        <h1>Sign In</h1>

        <label htmlFor="role">Sign in as</label>
        {/* Checked against the account server-side, so picking the wrong one is
            a clear error rather than a downgraded session. */}
        <select
          id="role"
          name="role"
          required
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role);
            resetCodeStep();
          }}
        >
          <option value="EMPLOYEE">Employee</option>
          <option value="ADMIN">Admin / HR</option>
        </select>

        <label htmlFor="identifier">Login Id / Email</label>
        {/* Accepts either — the server looks up both columns. */}
        <input
          id="identifier"
          name="identifier"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            resetCodeStep();
          }}
        />

        <label htmlFor="password">Password</label>
        <div className="field-with-action">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              resetCodeStep();
            }}
          />
          <button
            type="button"
            onClick={sendCode}
            disabled={sending || !identifier.trim() || !password}
          >
            {sending ? 'Sending…' : codeSent ? 'Resend code' : 'Send code'}
          </button>
        </div>

        {note && <p className="notice">{note}</p>}

        {codeSent && (
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
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !codeSent}>
          {busy ? 'Signing in…' : 'SIGN IN'}
        </button>
        {!codeSent && <p className="hint">Send a verification code to sign in.</p>}

        <p className="auth-alt">
          Don&apos;t have an Account? <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </div>
  );
}
