import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCart } from '../lib/CartContext';
import { usePageTitle } from '../lib/usePageTitle';

export default function Checkout() {
  const { stallId } = useParams();
  const navigate = useNavigate();
  const cart = useCart();

  usePageTitle('Review your order');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (cart.lines.length === 0 || String(cart.stallId) !== String(stallId)) {
    return (
      <div className="min-h-screen bg-paper px-6 py-10">
        <p className="text-stone">Your cart is empty.</p>
        <Link to={`/stall/${stallId}`} className="mt-4 inline-block text-sm underline">
          ← Back to menu
        </Link>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please tell us your name so we can call your order.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const order = await api.placeOrder({
        stall_id: Number(stallId),
        customer_name: name.trim(),
        customer_phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        items: cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
      });
      cart.clearCart();
      navigate(`/order/${order.order_number}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper px-6 py-8 md:px-12">
      <Link to={`/stall/${stallId}`} className="font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
        ← Back to menu
      </Link>
      <h1 className="mt-2 font-display text-3xl md:text-5xl">Review your order</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit} className="order-2 lg:order-1">
          <label className="block">
            <span className="text-sm font-medium">Your name</span>
            <input
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rajarsi"
              autoFocus
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-medium">Phone (optional)</span>
            <input
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="In case the stall needs to reach you"
              type="tel"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-medium">Notes for the stall (optional)</span>
            <textarea
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. less spicy, no onions"
              rows={3}
            />
          </label>

          {error && <p className="mt-4 text-sm text-paprika-dark">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full border-2 border-ink bg-paprika px-6 py-3.5 font-medium text-white hover:bg-paprika-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Placing order…' : `Place order — ₹${cart.total.toFixed(0)}`}
          </button>
          <p className="mt-3 text-xs text-stone">
            Payment isn't collected here — settle up with the stall directly, then they'll mark it received.
          </p>
        </form>

        <aside className="order-1 border-2 border-ink bg-white p-5 lg:order-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-stone">Your items</h2>
          <div className="mt-3 divide-y divide-line">
            {cart.lines.map((l) => (
              <div key={l.menu_item_id} className="flex justify-between py-2.5 text-sm">
                <span>
                  {l.quantity} × {l.name}
                </span>
                <span className="font-mono tabular-nums">₹{(l.price * l.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t-2 border-ink pt-3 font-display text-lg">
            <span>Total</span>
            <span className="tabular-nums">₹{cart.total.toFixed(0)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
