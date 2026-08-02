import { Navigate } from 'react-router-dom';
import RequireOwnerAuth from './RequireOwnerAuth';
import { useOwnerAuth } from '../lib/OwnerAuthContext';

function ManagerGate({ children }) {
  const { owner } = useOwnerAuth();
  if (owner?.staff_role !== 'manager') return <Navigate to="/owner/dashboard" replace />;
  return children;
}

export default function RequireManager({ children }) {
  return (
    <RequireOwnerAuth>
      <ManagerGate>{children}</ManagerGate>
    </RequireOwnerAuth>
  );
}
