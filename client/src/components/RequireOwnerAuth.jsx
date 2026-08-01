import { Navigate } from 'react-router-dom';
import { useOwnerAuth } from '../lib/OwnerAuthContext';

export default function RequireOwnerAuth({ children }) {
  const { stall, ready } = useOwnerAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-dim">
        <p className="text-stone">Loading…</p>
      </div>
    );
  }

  if (!stall) {
    return <Navigate to="/owner/login" replace />;
  }

  return children;
}
