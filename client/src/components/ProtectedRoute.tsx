import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Loading } from './common';

/**
 * Gates authenticated routes.
 *
 * The server enforces all of this independently — these redirects only make
 * the experience sane instead of a wall of 401/403 responses.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading what="Checking your session" />;
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;

  // A generated first-time password blocks everything else, mirroring the
  // server's PASSWORD_CHANGE_REQUIRED guard.
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

/**
 * The landing page after sign-in, and the safe place to bounce anyone who
 * reaches a page their role cannot use.
 *
 * These differ by role because `/employees` is admin-only: sending an employee
 * there would bounce them straight back here and loop.
 */
export function homeFor(role: 'ADMIN' | 'EMPLOYEE' | undefined) {
  return role === 'ADMIN' ? '/employees' : '/attendance';
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to={homeFor(user?.role)} replace />;
  return <>{children}</>;
}
