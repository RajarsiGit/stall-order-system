import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/usePageTitle';

const STATUS_LABEL = {
  placed: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  handed_over: 'Handed over',
  cancelled: 'Cancelled',
};

export default function CustomerOrders() {
  usePageTitle('Your orders');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getCustomerOrders()
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-paper px-6 py-10 md:px-12">
      <Link to="/stalls" className="font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
        ← All stalls
      </Link>
      <h1 className="mt-4 font-display text-3xl md:text-5xl">Your orders</h1>

      {error && (
        <div className="mt-6 border-2 border-paprika bg-paprika/10 px-4 py-3 text-paprika-dark">{error}</div>
      )}
      {!orders && !error && <p className="mt-6 text-stone">Loading your orders…</p>}
      {orders && orders.length === 0 && <p className="mt-6 text-stone">You haven't placed any orders yet.</p>}

      <div className="mt-6 max-w-lg space-y-3">
        {orders?.map((order) => (
          <Link
            key={order.id}
            to={`/order/${order.order_number}`}
            className="flex items-center justify-between border-2 border-ink bg-white px-4 py-3 transition-transform hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#1c1917]"
          >
            <div>
              <p className="font-display text-xl tabular-nums">{order.order_number}</p>
              <p className="mt-0.5 text-sm text-stone">₹{order.total_amount.toFixed(0)}</p>
            </div>
            <span
              className={`border px-2.5 py-1 text-xs font-medium ${
                order.status === 'cancelled'
                  ? 'border-paprika bg-paprika/10 text-paprika-dark'
                  : order.status === 'handed_over'
                    ? 'border-herb bg-herb-light text-herb'
                    : 'border-turmeric bg-turmeric-light text-ink'
              }`}
            >
              {STATUS_LABEL[order.status]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
