import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { homeFor } from './ProtectedRoute';

/**
 * Persistent chrome:
 *   Logo | [Employees] | My Profile | Attendance | Time Off   [avatar ▾]
 *
 * Employees is admin-only, so an employee sees the nav without it.
 */
export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link to={homeFor(user.role)} className="brand">
          {user.company.logoUrl ? (
            <img src={user.company.logoUrl} alt={user.company.name} className="company-logo" />
          ) : (
            <span className="company-logo company-logo-fallback">{user.company.code}</span>
          )}
          <span className="company-name">{user.company.name}</span>
        </Link>

        <nav className="main-nav">
          {/* Admin-only. The server refuses the list for an employee anyway;
              hiding the link stops them walking into a 403. */}
          {user.role === 'ADMIN' && <NavLink to="/employees">Employees</NavLink>}
          <NavLink to="/profile">My Profile</NavLink>
          <NavLink to="/attendance">Attendance</NavLink>
          <NavLink to="/time-off">Time Off</NavLink>
        </nav>

        <div className="avatar-menu">
          <button
            type="button"
            className="avatar-button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="avatar" />
            ) : (
              <span className="avatar avatar-fallback">
                {user.firstName[0]}
                {user.lastName[0]}
              </span>
            )}
            <span className="avatar-name">
              {user.firstName} {user.lastName}
            </span>
          </button>

          {menuOpen && (
            <ul className="avatar-dropdown" role="menu">
              <li role="none">
                <Link role="menuitem" to="/profile" onClick={() => setMenuOpen(false)}>
                  My Profile
                </Link>
              </li>
              <li role="none">
                <button role="menuitem" type="button" onClick={handleSignOut}>
                  Log Out
                </button>
              </li>
            </ul>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
