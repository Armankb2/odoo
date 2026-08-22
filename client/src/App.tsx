import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/AppShell';
import { AdminRoute, ProtectedRoute, homeFor } from './components/ProtectedRoute';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { ChangePassword } from './pages/ChangePassword';
import { Employees } from './pages/Employees';
import { EmployeeDetail } from './pages/EmployeeDetail';
import { NewEmployee } from './pages/NewEmployee';
import { EditEmployee } from './pages/EditEmployee';
import { Profile } from './pages/Profile';
import { Attendance } from './pages/Attendance';
import { TimeOff } from './pages/TimeOff';

/** Sends each role to a page it is actually allowed to open. */
function Home() {
  const { user } = useAuth();
  return <Navigate to={homeFor(user?.role)} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        {/* Admin-only: PROBLEM_STATEMENT.md §3.2.2 puts the employee list on the
            Admin / HR dashboard, and §2 gives an employee no directory at all. */}
        <Route
          path="/employees"
          element={
            <AdminRoute>
              <Employees />
            </AdminRoute>
          }
        />
        <Route
          path="/employees/new"
          element={
            <AdminRoute>
              <NewEmployee />
            </AdminRoute>
          }
        />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route
          path="/employees/:id/edit"
          element={
            <AdminRoute>
              <EditEmployee />
            </AdminRoute>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/time-off" element={<TimeOff />} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
