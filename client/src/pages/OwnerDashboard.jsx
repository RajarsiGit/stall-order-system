import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useOwnerAuth } from '../lib/OwnerAuthContext';
import { usePageTitle } from '../lib/usePageTitle';

const NEXT_STATUS = {
  placed: { next: 'preparing', label: 'Start preparing', color: 'turmeric' },
  preparing: { next: 'ready', label: 'Mark ready', color: 'herb' },
  ready: { next: 'handed_over', label: 'Mark handed over', color: 'ink' },
};

const STATUS_LABEL = {
  placed: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  handed_over: 'Handed over',
  cancelled: 'Cancelled',
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function OrderCard({ order, onAdvance, onCancel, onTogglePayment, busy }) {
  const action = NEXT_STATUS[order.status];
  return (
    <div className="ticket-edge border-2 border-ink bg-white px-5 pb-7 pt-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-2xl tabular-nums">{order.order_number}</p>
          <p className="text-sm text-stone">{order.customer_name}</p>
        </div>
        <span className="font-mono text-xs text-stone">{timeAgo(order.created_at)}</span>
      </div>

      <div className="mt-3 divide-y divide-line border-y border-line">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1.5 text-sm">
            <span>
              {item.quantity} × {item.item_name}
            </span>
          </div>
        ))}
      </div>

      {order.notes && (
        <p className="mt-2 border border-turmeric bg-turmeric-light px-2.5 py-1.5 text-xs">
          Note: {order.notes}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-sm tabular-nums">₹{order.total_amount.toFixed(0)}</span>
        <button
          onClick={() => onTogglePayment(order)}
          className={`border px-2 py-0.5 text-xs font-medium transition-colors ${
            order.payment_status === 'paid'
              ? 'border-herb bg-herb-light text-herb'
              : 'border-turmeric bg-turmeric-light text-ink hover:bg-turmeric'
          }`}
        >
          {order.payment_status === 'paid' ? 'Paid ✓' : 'Mark paid'}
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {action && (
          <button
            disabled={busy}
            onClick={() => onAdvance(order, action.next)}
            className="flex-1 border-2 border-ink bg-ink px-3 py-2.5 text-sm font-medium text-paper hover:bg-paprika hover:border-paprika transition-colors disabled:opacity-50"
          >
            {action.label} →
          </button>
        )}
        {order.status === 'placed' && (
          <button
            disabled={busy}
            onClick={() => onCancel(order)}
            className="border-2 border-line px-3 py-2.5 text-sm text-stone hover:border-paprika hover:text-paprika-dark transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

const COLUMNS = [
  { key: 'placed', title: 'New orders' },
  { key: 'preparing', title: 'Preparing' },
  { key: 'ready', title: 'Ready for pickup' },
];

export default function OwnerDashboard() {
  const { stall, logout, setStall } = useOwnerAuth();

  usePageTitle(stall?.name ? `${stall.name} dashboard` : 'Stall dashboard');
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(() => {
    api
      .getOwnerOrders()
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  async function handleAdvance(order, nextStatus) {
    setBusyId(order.id);
    try {
      await api.updateOrderStatus(order.id, nextStatus);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(order) {
    if (!confirm(`Cancel order ${order.order_number}?`)) return;
    setBusyId(order.id);
    try {
      await api.updateOrderStatus(order.id, 'cancelled');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePayment(order) {
    const next = order.payment_status === 'paid' ? 'pending' : 'paid';
    setBusyId(order.id);
    try {
      await api.updatePaymentStatus(order.id, next);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStallOpen() {
    try {
      const updated = await api.setStallOpen(!stall.is_open);
      setStall(updated);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleLogout() {
    logout();
    navigate('/owner/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-paper-dim">
      <header className="border-b-2 border-ink bg-paper px-6 py-5 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone">Stall dashboard</p>
            <h1 className="font-display text-3xl">{stall?.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleStallOpen}
              className={`border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                stall?.is_open
                  ? 'border-herb bg-herb-light text-herb hover:bg-herb hover:text-white'
                  : 'border-stone bg-stone-light text-stone hover:bg-stone hover:text-white'
              }`}
            >
              {stall?.is_open ? '● Open — click to close' : '○ Closed — click to open'}
            </button>
            <Link to="/owner/menu" className="border-2 border-ink px-3 py-1.5 text-sm font-medium hover:bg-ink hover:text-paper transition-colors">
              Edit menu
            </Link>
            <button onClick={handleLogout} className="text-sm text-stone underline hover:text-ink">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8 md:px-10">
        {error && (
          <div className="mb-6 border-2 border-paprika bg-paprika/10 px-4 py-3 text-paprika-dark">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.key);
            return (
              <div key={col.key}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-mono text-sm font-semibold uppercase tracking-wider">{col.title}</h2>
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-bold text-paper">
                    {colOrders.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {colOrders.length === 0 && (
                    <p className="border-2 border-dashed border-line px-4 py-8 text-center text-sm text-stone">
                      Nothing here right now
                    </p>
                  )}
                  {colOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAdvance={handleAdvance}
                      onCancel={handleCancel}
                      onTogglePayment={handleTogglePayment}
                      busy={busyId === order.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
