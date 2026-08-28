import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequiresAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequiresPlatformAdmin() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'PLATFORM_ADMIN') return <Navigate to="/app" replace />;
  return <Outlet />;
}