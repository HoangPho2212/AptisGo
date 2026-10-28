import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AuthProvider from './auth/AuthProvider.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import { useAuth } from './auth/useAuth.js';
import AccessDeniedPage from './pages/AccessDeniedPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';

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
