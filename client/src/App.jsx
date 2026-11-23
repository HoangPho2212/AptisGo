import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AuthProvider from './auth/AuthProvider.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import { useAuth } from './auth/useAuth.js';
import DashboardPage from './dashboard/DashboardPage.jsx';
import MockExamPage from './exam/MockExamPage.jsx';
import GoalsPage from './goals/GoalsPage.jsx';
import AccessDeniedPage from './pages/AccessDeniedPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import PlacementPage from './placement/PlacementPage.jsx';

function RoleHomeRedirect() {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/${role}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleHomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/placement"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <PlacementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/goals"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <GoalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tests/:id"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <MockExamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer"
            element={
              <ProtectedRoute allowedRoles={['lecturer']}>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route path="/unauthorized" element={<AccessDeniedPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
