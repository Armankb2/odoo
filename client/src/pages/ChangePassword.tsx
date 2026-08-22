import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

/**
 * Forced first-login password change. Reachable normally too, so it doubles as
 * the Security tab's change-password form.
 */
export function ChangePassword() {
  const { user, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const forced = user?.mustChangePassword ?? false;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
      await refresh();
      setDone(true);
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
        <h1>Change Password</h1>

        {forced && (
          <p className="notice" role="status">
            Your account was created with a system-generated password. Please choose a new one
            before continuing.
          </p>
        )}
        {done && <p className="notice">Password updated.</p>}

        <label htmlFor="currentPassword">Current Password</label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />

        <label htmlFor="newPassword">New Password</label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
        />

        <label htmlFor="confirm">Confirm New Password</label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Update Password'}
        </button>

        {forced && (
          <button type="button" onClick={() => void signOut().then(() => navigate('/signin'))}>
            Log Out
          </button>
        )}
      </form>
    </div>
  );
}
