import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCart } from '../lib/CartContext';
import { usePageTitle } from '../lib/usePageTitle';

export default function StallMenu() {
  const { stallId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const cart = useCart();

  usePageTitle(data?.stall?.name || 'Menu');

  useEffect(() => {
    api
      .getStallMenu(stallId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [stallId]);

  if (cart.stallId != null && String(cart.stallId) !== String(stallId) && cart.lines.length > 0) {
    // handled inline below via a banner, not a blocking redirect
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper px-6 py-10">
        <p className="text-paprika-dark">{error}</p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          ← Back to stalls
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-paper px-6 py-10">
        <p className="text-stone">Loading menu…</p>
      </div>
    );
  }

  const { stall, items } = data;
  const cartLine = (id) => cart.lines.find((l) => l.menu_item_id === id);
  const switchingStalls = cart.stallId != null && String(cart.stallId) !== String(stallId) && cart.lines.length > 0;

  return (
    <div className="min-h-screen bg-paper pb-32">
      <header className="border-b-2 border-ink px-6 py-6 md:px-12">
        <Link to="/" className="font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
          ← All stalls
        </Link>
        <h1 className="mt-2 font-display text-3xl md:text-5xl">{stall.name}</h1>
        {stall.description && <p className="mt-2 text-stone">{stall.description}</p>}
      </header>

      <main className="px-6 py-8 md:px-12">
        {switchingStalls && (
          <div className="mb-6 border-2 border-turmeric bg-turmeric-light px-4 py-3 text-sm">
            You have items from another stall in your cart. Adding something here will clear that cart.
          </div>
        )}

        {items.length === 0 && <p className="text-stone">This stall hasn't added any menu items yet.</p>}

        <div className="divide-y divide-line border-y border-line">
          {items.map((item) => {
            const line = cartLine(item.id);
            return (
              <div key={item.id} className="flex items-center justify-between gap-4 py-5">
                <div className="min-w-0">
                  <h3 className={`font-display text-lg ${!item.is_available ? 'text-stone line-through' : ''}`}>
                    {item.name}
                  </h3>
                  {item.description && <p className="mt-0.5 text-sm text-stone">{item.description}</p>}
                  <p className="mt-1 font-mono text-sm">₹{item.price.toFixed(0)}</p>
                </div>

                {!item.is_available ? (
                  <span className="shrink-0 font-mono text-xs text-stone">Unavailable</span>
                ) : line ? (
                  <div className="flex shrink-0 items-center gap-3 border-2 border-ink">
                    <button
                      className="px-3 py-2 font-mono text-lg hover:bg-paper-dim"
                      onClick={() => cart.decrementItem(item.id)}
                      aria-label={`Remove one ${item.name}`}
                    >
                      −
                    </button>
                    <span className="w-4 text-center font-mono tabular-nums">{line.quantity}</span>
                    <button
                      className="px-3 py-2 font-mono text-lg hover:bg-paper-dim"
                      onClick={() =>
                        cart.addItem({ stallId: stall.id, menu_item_id: item.id, name: item.name, price: item.price })
                      }
                      aria-label={`Add one ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="shrink-0 border-2 border-ink px-4 py-2 font-medium hover:bg-ink hover:text-paper transition-colors"
                    onClick={() =>
                      cart.addItem({ stallId: stall.id, menu_item_id: item.id, name: item.name, price: item.price })
                    }
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {cart.itemCount > 0 && String(cart.stallId) === String(stallId) && (
        <div className="fixed bottom-0 left-0 right-0 border-t-2 border-ink bg-ink px-6 py-4 text-paper md:px-12">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-paper/60">
                {cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''}
              </p>
              <p className="font-display text-xl">₹{cart.total.toFixed(0)}</p>
            </div>
            <button
              className="border-2 border-paper bg-paprika px-6 py-3 font-medium hover:bg-paprika-dark transition-colors"
              onClick={() => navigate(`/stall/${stallId}/checkout`)}
            >
              Review order →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
