import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { ErrorNote, Loading, PageHeader } from '../components/common';
import { ProfileHeader, ProfileTabs, type EmployeeFull } from '../components/ProfileTabs';

/**
 * "My Profile" — the wireframe opens the employee's own profile in form view.
 *
 * Only the fields the server's field-policy allows an employee to change are
 * editable here. The server rejects anything else outright, so this form is a
 * convenience, not the security boundary.
 */
const EDITABLE = [
  ['mobile', 'Mobile'],
  ['personalEmail', 'Personal Email'],
  ['residingAddress', 'Residing Address'],
  ['about', 'About'],
  ['whatILoveAboutJob', 'What I love about my job'],
  ['interestsAndHobbies', 'My interests and hobbies'],
] as const;

export function Profile() {
  const { user, refresh } = useAuth();
  const { data, error, loading, reload } = useAsync(
    () => api.get<{ employee: EmployeeFull }>(`/api/employees/${user!.id}`),
    [user?.id],
  );

  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const e = data.employee as unknown as Record<string, unknown>;
    setForm(Object.fromEntries(EDITABLE.map(([k]) => [k, (e[k] as string) ?? ''])));
  }, [data]);

  if (loading) return <Loading what="Loading your profile" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const onSave = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setSaveError(null);
    setSaved(false);
    try {
      await api.patch(`/api/employees/${user!.id}`, form);
      setSaved(true);
      reload();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="profile-page">
      <PageHeader title="My Profile" />
      {/* Your own picture is always yours to change. `refresh()` as well as
          `reload()` so the avatar in the top-right nav updates too, not just
          this page. */}
      <ProfileHeader
        e={data.employee}
        onAvatarChange={() => {
          reload();
          void refresh();
        }}
      />

      <form className="profile-form" onSubmit={onSave}>
        <h3>Edit my details</h3>
        {EDITABLE.map(([key, label]) => (
          <div key={key} className="form-row">
            <label htmlFor={key}>{label}</label>
            {key === 'about' || key === 'whatILoveAboutJob' || key === 'interestsAndHobbies' ? (
              <textarea
                id={key}
                rows={3}
                value={form[key] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            ) : (
              <input
                id={key}
                value={form[key] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            )}
          </div>
        ))}

        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        {saved && <p className="notice">Saved.</p>}

        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <p className="hint">
          Other fields are managed by HR. Ask an administrator to change your job details, salary or
          bank information.
        </p>
      </form>

      <ProfileTabs
        e={data.employee}
        onSalarySaved={reload}
        extraSecurity={
          <Link className="button" to="/change-password">
            Change password
          </Link>
        }
      />
    </section>
  );
}
