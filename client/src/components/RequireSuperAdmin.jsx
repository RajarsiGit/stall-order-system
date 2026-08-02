import { Navigate } from 'react-router-dom';
import RequireAdminAuth from './RequireAdminAuth';
import { useAdminAuth } from '../lib/AdminAuthContext';

function SuperAdminGate({ children }) {
  const { admin } = useAdminAuth();
  if (admin?.admin_role !== 'superadmin') return <Navigate to="/admin/dashboard" replace />;
  return children;
}

export default function RequireSuperAdmin({ children }) {
  return (
    <RequireAdminAuth>
      <SuperAdminGate>{children}</SuperAdminGate>
    </RequireAdminAuth>
  );
}
