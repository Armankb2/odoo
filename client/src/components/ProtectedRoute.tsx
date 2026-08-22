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

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/employees" replace />;
  return <>{children}</>;
}
