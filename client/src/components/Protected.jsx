import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '../auth';
import { PageLoader } from './ui';

/** Route guard: needs a signed-in user, optionally one of the given roles. */
export default function Protected({ roles }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
