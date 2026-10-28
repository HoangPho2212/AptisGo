import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './useAuth.js';

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ from: location.pathname, requiredRoles: allowedRoles }}
      />
    );
  }

  return children;
}
