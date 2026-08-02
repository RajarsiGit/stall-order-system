import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAdminAuth } from '../lib/AdminAuthContext';
import { usePageTitle } from '../lib/usePageTitle';

export default function AdminDashboard() {
  const { admin, logout } = useAdminAuth();
  const isSuperAdmin = admin?.admin_role === 'superadmin';

  usePageTitle('Admin dashboard');
  const [stalls, setStalls] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', owner_username: '', owner_password: '' });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .getAdminStalls()
      .then(setStalls)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.owner_username.trim() || !form.owner_password) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createStall({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        owner_username: form.owner_username.trim(),
        owner_password: form.owner_password,
      });
      setForm({ name: '', description: '', owner_username: '', owner_password: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-dim">
      <header className="border-b-2 border-ink bg-paper px-6 py-5 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone">Admin</p>
            <h1 className="mt-1 font-display text-3xl">Stalls</h1>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Link to="/admin/admins" className="text-sm text-stone underline hover:text-ink">
                Admin accounts
              </Link>
            )}
            <Link to="/" className="text-sm text-stone underline hover:text-ink">
              Customer side
            </Link>
            <button onClick={logout} className="text-sm text-stone underline hover:text-ink">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-8 px-6 py-8 md:px-10 lg:grid-cols-[1fr_360px]">
        <div>
          {error && (
            <div className="mb-4 border-2 border-paprika bg-paprika/10 px-4 py-3 text-paprika-dark">{error}</div>
          )}

          {!stalls && !error && <p className="text-stone">Loading stalls…</p>}
          {stalls && stalls.length === 0 && <p className="text-stone">No stalls yet — add the first one.</p>}

          <div className="space-y-3">
            {stalls?.map((stall) => (
              <div key={stall.id} className="flex items-center justify-between gap-4 border-2 border-ink bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{stall.name}</p>
                  {stall.description && <p className="text-sm text-stone">{stall.description}</p>}
                  <p className="mt-1 font-mono text-xs text-stone">
                    Owner login: {stall.owner_username || '—'}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-2.5 py-1 text-xs font-medium ${
                    stall.is_open
                      ? 'border-herb bg-herb-light text-herb'
                      : 'border-stone bg-stone-light text-stone'
                  }`}
                >
                  {stall.is_open ? 'Open' : 'Closed'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="h-fit border-2 border-ink bg-white p-5">
          <h2 className="font-display text-xl">Add stall</h2>
          <form onSubmit={handleAdd} className="mt-4">
            <label className="block">
              <span className="text-sm font-medium">Stall name</span>
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
              <span className="text-sm font-medium">Owner username</span>
              <input
                className="mt-1.5 w-full border-2 border-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-paprika"
                value={form.owner_username}
                onChange={(e) => setForm((f) => ({ ...f, owner_username: e.target.value }))}
                autoCapitalize="none"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Owner password</span>
              <input
                type="password"
                className="mt-1.5 w-full border-2 border-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-paprika"
                value={form.owner_password}
                onChange={(e) => setForm((f) => ({ ...f, owner_password: e.target.value }))}
                minLength={6}
              />
              <span className="mt-1 block text-xs text-stone">At least 6 characters.</span>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full border-2 border-ink bg-ink px-4 py-2.5 font-medium text-paper hover:bg-paprika hover:border-paprika transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create stall'}
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}
