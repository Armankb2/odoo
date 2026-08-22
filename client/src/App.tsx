import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AdminRoute, ProtectedRoute } from './components/ProtectedRoute';
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
        {/* The wireframe's "after login the user must land on this page" is the
            employee list, not a card dashboard. */}
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="/employees" element={<Employees />} />
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

      <Route path="*" element={<Navigate to="/employees" replace />} />
    </Routes>
  );
}
