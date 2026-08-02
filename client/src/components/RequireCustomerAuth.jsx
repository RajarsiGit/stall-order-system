import { Navigate } from 'react-router-dom';
import { useCustomerAuth } from '../lib/CustomerAuthContext';

export default function RequireCustomerAuth({ children }) {
  const { customer, ready } = useCustomerAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-dim">
        <p className="text-stone">Loading…</p>
      </div>
    );
  }

  if (!customer) {
    return <Navigate to="/customer/login" replace />;
  }

  return children;
}
