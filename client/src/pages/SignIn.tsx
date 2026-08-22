import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { homeFor } from '../components/ProtectedRoute';
import type { Role } from '../lib/api';

export function SignIn() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(identifier.trim(), password, role);
      navigate(homeFor(role), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
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
          onChange={(e) => setRole(e.target.value as Role)}
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
          onChange={(e) => setIdentifier(e.target.value)}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'SIGN IN'}
        </button>

        <p className="auth-alt">
          Don&apos;t have an Account? <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </div>
  );
}
