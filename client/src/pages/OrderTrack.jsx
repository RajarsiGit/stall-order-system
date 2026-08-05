import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/usePageTitle';

const STEPS = [
  { key: 'placed', label: 'Order placed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready for pickup' },
  { key: 'handed_over', label: 'Handed over' },
];

function StatusBanner({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="border-2 border-paprika bg-paprika/10 px-4 py-3 text-paprika-dark">
        This order was cancelled by the stall. If that's unexpected, check with them directly.
      </div>
    );
  }
  if (status === 'ready') {
    return (
      <div className="border-2 border-herb bg-herb-light px-4 py-3 text-herb">
        Your order is ready — head to the stall to pick it up!
      </div>
    );
  }
  return null;
}

export default function OrderTrack() {
  const { orderNumber: routeOrderNumber } = useParams();
  const [inputNumber, setInputNumber] = useState(routeOrderNumber || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!routeOrderNumber);
  const pollRef = useRef(null);

  usePageTitle(order ? `Order ${order.order_number}` : 'Track your order');

  function fetchOrder(num) {
    setError('');
    api
      .trackOrder(num)
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    if (!routeOrderNumber) return;
    fetchOrder(routeOrderNumber);
    pollRef.current = setInterval(() => fetchOrder(routeOrderNumber), 5000);
    return () => clearInterval(pollRef.current);
  }, [routeOrderNumber]);

  function handleSearch(e) {
    e.preventDefault();
    if (!inputNumber.trim()) return;
    window.location.href = `/order/${inputNumber.trim().toUpperCase()}`;
  }

  if (!routeOrderNumber) {
    return (
      <div className="min-h-screen bg-paper px-6 py-10 md:px-12">
        <Link to="/" className="font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
          ← All stalls
        </Link>
        <h1 className="mt-4 font-display text-3xl md:text-5xl">Track your order</h1>
        <form onSubmit={handleSearch} className="mt-6 flex max-w-sm gap-2">
          <input
            className="flex-1 border-2 border-ink bg-white px-3 py-2.5 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-paprika"
            placeholder="e.g. CU-0191"
            value={inputNumber}
            onChange={(e) => setInputNumber(e.target.value)}
          />
          <button className="border-2 border-ink bg-ink px-5 py-2.5 font-medium text-paper hover:bg-paprika hover:border-paprika transition-colors">
            Track
          </button>
        </form>
      </div>
    );
  }

  const currentIndex = order ? STEPS.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="min-h-screen bg-paper px-6 py-10 md:px-12">
      <Link to="/" className="font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
        ← All stalls
      </Link>

      {loading && <p className="mt-6 text-stone">Loading your order…</p>}
      {error && (
        <div className="mt-6 border-2 border-paprika bg-paprika/10 px-4 py-3 text-paprika-dark">
          Couldn't find that order: {error}
        </div>
      )}

      {order && (
        <div className="mt-6 max-w-lg">
          <div className="ticket-edge border-2 border-ink bg-white px-6 pb-8 pt-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone">Order number</p>
            <h1 className="mt-1 font-display text-4xl tabular-nums">{order.order_number}</h1>
            <p className="mt-1 text-stone">For {order.customer_name}</p>

            <div className="mt-6">
              <StatusBanner status={order.status} />
            </div>

            {order.pickup_pin && order.status !== 'cancelled' && order.status !== 'handed_over' && (
              <div className="mt-4 border-2 border-ink bg-turmeric-light px-4 py-3 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone">Pickup PIN</p>
                <p className="mt-1 font-display text-3xl tabular-nums tracking-widest">{order.pickup_pin}</p>
                <p className="mt-1 text-xs text-stone">Give this to the stall when you collect your order.</p>
              </div>
            )}

            {order.status !== 'cancelled' && (
              <ol className="mt-6 space-y-0">
                {STEPS.map((step, i) => {
                  const reached = currentIndex >= i;
                  const isCurrent = currentIndex === i;
                  return (
                    <li key={step.key} className="flex items-start gap-3 pb-5 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                            reached ? 'border-herb bg-herb text-white' : 'border-line bg-white text-stone'
                          }`}
                        >
                          {reached ? '✓' : ''}
                        </span>
                        {i < STEPS.length - 1 && (
                          <span className={`mt-1 h-8 w-0.5 ${reached ? 'bg-herb' : 'bg-line'}`} />
                        )}
                      </div>
                      <span className={`pt-0.5 ${isCurrent ? 'font-semibold text-ink' : reached ? 'text-ink' : 'text-stone'}`}>
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-6 border-t border-line pt-4">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone">Items</h2>
              <div className="mt-2 divide-y divide-line">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 text-sm">
                    <span>
                      {item.quantity} × {item.item_name}
                    </span>
                    <span className="font-mono tabular-nums">₹{(item.item_price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between border-t-2 border-ink pt-2 font-display text-lg">
                <span>Total</span>
                <span className="tabular-nums">₹{order.total_amount.toFixed(0)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-stone">Payment:</span>
              <span
                className={`border px-2 py-0.5 text-xs font-medium ${
                  order.payment_status === 'paid'
                    ? 'border-herb bg-herb-light text-herb'
                    : 'border-turmeric bg-turmeric-light text-ink'
                }`}
              >
                {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-stone">This page updates automatically every few seconds.</p>
        </div>
      )}
    </div>
  );
}
