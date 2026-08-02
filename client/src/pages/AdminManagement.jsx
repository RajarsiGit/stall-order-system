import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/usePageTitle';

export default function AdminManagement() {
  usePageTitle('Manage admins');
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', admin_role: 'admin' });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .getAdminAdmins()
      .then(setAdmins)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createAdminAccount({
        username: form.username.trim(),
        password: form.password,
        admin_role: form.admin_role,
      });
      setForm({ username: '', password: '', admin_role: 'admin' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleRole(admin) {
    const nextRole = admin.admin_role === 'superadmin' ? 'admin' : 'superadmin';
    setError('');
    try {
      await api.updateAdminAccount(admin.id, { admin_role: nextRole });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(admin) {
    if (!confirm(`Remove admin account "${admin.username}"?`)) return;
    setError('');
    try {
      await api.deleteAdminAccount(admin.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-paper-dim">
      <header className="border-b-2 border-ink bg-paper px-6 py-5 md:px-10">
        <Link to="/admin/dashboard" className="font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
          ← Dashboard
        </Link>
        <h1 className="mt-1 font-display text-3xl">Admin accounts</h1>
      </header>

      <main className="grid grid-cols-1 gap-8 px-6 py-8 md:px-10 lg:grid-cols-[1fr_360px]">
        <div>
          {error && (
            <div className="mb-4 border-2 border-paprika bg-paprika/10 px-4 py-3 text-paprika-dark">{error}</div>
          )}

          {!admins && <p className="text-stone">Loading admins…</p>}

          <div className="space-y-3">
            {admins?.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between gap-4 border-2 border-ink bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{admin.username}</p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-wider text-stone">{admin.admin_role}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggleRole(admin)}
                    className="border border-line px-2.5 py-1 text-xs font-medium text-stone hover:border-ink hover:text-ink transition-colors"
                  >
                    Make {admin.admin_role === 'superadmin' ? 'Admin' : 'Super-admin'}
                  </button>
                  <button
                    onClick={() => handleDelete(admin)}
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
          <h2 className="font-display text-xl">Add admin account</h2>
          <form onSubmit={handleAdd} className="mt-4">
            <label className="block">
              <span className="text-sm font-medium">Username</span>
              <input
                className="mt-1.5 w-full border-2 border-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-paprika"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                autoCapitalize="none"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Password</span>
              <input
                type="password"
                className="mt-1.5 w-full border-2 border-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-paprika"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                minLength={6}
              />
              <span className="mt-1 block text-xs text-stone">At least 6 characters.</span>
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Role</span>
              <select
                className="mt-1.5 w-full border-2 border-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-paprika"
                value={form.admin_role}
                onChange={(e) => setForm((f) => ({ ...f, admin_role: e.target.value }))}
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Super-admin</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full border-2 border-ink bg-ink px-4 py-2.5 font-medium text-paper hover:bg-paprika hover:border-paprika transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add admin account'}
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}
