import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type EmployeeCard } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/common';
import { statusLabel } from '../lib/format';

/** Landing page. Cards, not a table — per the wireframe. */
export function Employees() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');

  const { data, error, loading, reload } = useAsync(
    () => api.get<{ employees: EmployeeCard[] }>(`/api/employees?search=${encodeURIComponent(applied)}`),
    [applied],
  );

  return (
    <section className="employees-page">
      <PageHeader
        title="Employees"
        actions={
          user?.role === 'ADMIN' ? (
            <Link className="button" to="/employees/new">
              NEW
            </Link>
          ) : null
        }
      />

      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search.trim());
        }}
      >
        <label htmlFor="employee-search">Search</label>
        <input
          id="employee-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, Login ID, email or position"
        />
        <button type="submit">Search</button>
      </form>

      {loading && <Loading what="Loading employees" />}
      <ErrorNote error={error} onRetry={reload} />

      {data && data.employees.length === 0 && (
        <Empty
          message="No employees match that search."
          action={
            applied ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setApplied('');
                }}
              >
                Clear search
              </button>
            ) : null
          }
        />
      )}

      <ul className="employee-cards">
        {data?.employees.map((e) => (
          <li key={e.id} className="employee-card">
            {/* Clicking a card opens the profile in view-only mode. */}
            <Link to={`/employees/${e.id}`} className="employee-card-link">
              {e.avatarUrl ? (
                <img src={e.avatarUrl} alt="" className="avatar" />
              ) : (
                <span className="avatar avatar-fallback">
                  {e.firstName[0]}
                  {e.lastName[0]}
                </span>
              )}

              <span className="employee-card-body">
                <strong className="employee-name">
                  {e.firstName} {e.lastName}
                </strong>
                <span className="employee-position">{e.jobPosition ?? '—'}</span>
                <span className="employee-department">{e.department ?? '—'}</span>
                <span className="employee-loginid">{e.loginId}</span>
              </span>

              {/* Derived server-side from today's attendance and approved
                  leave. data-status is for the stylesheet to hook the
                  green dot / aeroplane / yellow dot onto. */}
              <span
                className={`employee-status employee-status-${e.status}`}
                data-status={e.status}
                title={statusLabel(e.status)}
              >
                {statusLabel(e.status)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
