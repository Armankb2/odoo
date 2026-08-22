import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { ErrorNote, Loading, PageHeader } from '../components/common';
import { ProfileHeader, ProfileTabs, type EmployeeFull } from '../components/ProfileTabs';

/** View-only profile, per the wireframe's "open in a view-only (non-editable) mode".
 *  Admins get an Edit link out to the editor rather than inline editing here. */
export function EmployeeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data, error, loading, reload } = useAsync(
    () => api.get<{ employee: EmployeeFull }>(`/api/employees/${id}`),
    [id],
  );

  if (loading) return <Loading what="Loading profile" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const e = data.employee;

  return (
    <section className="employee-detail-page">
      <PageHeader
        title={`${e.firstName} ${e.lastName}`}
        actions={
          <>
            {isAdmin && (
              <Link className="button" to={`/employees/${e.id}/edit`}>
                Edit
              </Link>
            )}
            <Link className="button" to={`/attendance?userId=${e.id}`}>
              Attendance
            </Link>
            <Link className="button" to="/employees">
              Back
            </Link>
          </>
        }
      />
      <p className="view-only-note">
        {isAdmin ? 'Read-only view — use Edit to make changes.' : 'This profile is read-only.'}
      </p>
      {/* Admins may set anyone's picture; an employee reaching their own
          record through this route can set their own. Anyone else gets the
          read-only header, and the server enforces the same rule. */}
      <ProfileHeader
        e={e}
        onAvatarChange={
          user?.role === 'ADMIN' || user?.id === e.id ? () => reload() : undefined
        }
      />
      <ProfileTabs e={e} onSalarySaved={reload} />
    </section>
  );
}
