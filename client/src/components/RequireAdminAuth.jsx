import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../lib/AdminAuthContext';

export default function RequireAdminAuth({ children }) {
  const { admin, ready } = useAdminAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-dim">
        <p className="text-stone">Loading…</p>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
