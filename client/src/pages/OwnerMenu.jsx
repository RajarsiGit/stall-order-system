import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useOwnerAuth } from '../lib/OwnerAuthContext';
import { usePageTitle } from '../lib/usePageTitle';

export default function OwnerMenu() {
  const { stall } = useOwnerAuth();

  usePageTitle('Edit menu');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '' });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .getOwnerMenu()
      .then(setItems)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createMenuItem({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: parseFloat(form.price),
      });
      setForm({ name: '', description: '', price: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAvailable(item) {
    try {
      await api.updateMenuItem(item.id, { is_available: !item.is_available });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Remove "${item.name}" from the menu?`)) return;
    try {
      await api.deleteMenuItem(item.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-paper-dim">
      <header className="border-b-2 border-ink bg-paper px-6 py-5 md:px-10">
        <Link to="/owner/dashboard" className="font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
          ← Dashboard
        </Link>
        <h1 className="mt-1 font-display text-3xl">{stall?.name} — Menu</h1>
      </header>

      <main className="grid grid-cols-1 gap-8 px-6 py-8 md:px-10 lg:grid-cols-[1fr_360px]">
        <div>
          {error && (
            <div className="mb-4 border-2 border-paprika bg-paprika/10 px-4 py-3 text-paprika-dark">{error}</div>
          )}

          {!items && <p className="text-stone">Loading menu…</p>}

          {items && items.length === 0 && <p className="text-stone">No items yet — add your first one.</p>}

          <div className="space-y-3">
            {items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 border-2 border-ink bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className={`font-medium ${!item.is_available ? 'text-stone line-through' : ''}`}>{item.name}</p>
                  {item.description && <p className="text-sm text-stone">{item.description}</p>}
                  <p className="font-mono text-sm">₹{item.price.toFixed(0)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggleAvailable(item)}
                    className={`border px-2.5 py-1 text-xs font-medium transition-colors ${
                      item.is_available
                        ? 'border-herb bg-herb-light text-herb hover:bg-herb hover:text-white'
                        : 'border-stone bg-stone-light text-stone hover:bg-stone hover:text-white'
                    }`}
                  >
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="border border-line px-2.5 py-1 text-xs text-stone hover:border-paprika hover:text-paprika-dark transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="h-fit border-2 border-ink bg-white p-5">
          <h2 className="font-display text-xl">Add item</h2>
          <form onSubmit={handleAdd} className="mt-4">
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <input
                className="mt-1.5 w-full border-2 border-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-paprika"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Description (optional)</span>
              <input
                className="mt-1.5 w-full border-2 border-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-paprika"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Price (₹)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1.5 w-full border-2 border-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-paprika"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full border-2 border-ink bg-ink px-4 py-2.5 font-medium text-paper hover:bg-paprika hover:border-paprika transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add to menu'}
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}
