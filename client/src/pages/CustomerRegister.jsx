import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../lib/CustomerAuthContext';
import { usePageTitle } from '../lib/usePageTitle';
import logo from '../assets/logo.svg';

export default function CustomerRegister() {
  const { register } = useCustomerAuth();
  const navigate = useNavigate();

  usePageTitle('Create your account');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      navigate('/stalls', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-10">
      <div className="w-full max-w-sm">
        <img src={logo} alt="FoodCourt Hub" className="h-10 w-10" />
        <Link to="/" className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
          ← Back
        </Link>
        <h1 className="mt-3 font-display text-3xl">Create your account</h1>
        <p className="mt-2 text-sm text-stone">Takes a minute — then you're ready to order.</p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              autoCapitalize="none"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Phone (optional)</span>
            <input
              type="tel"
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={6}
            />
            <span className="mt-1 block text-xs text-stone">At least 6 characters.</span>
          </label>

          {error && <p className="mt-4 text-sm text-paprika-dark">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full border-2 border-ink bg-ink px-6 py-3 font-medium text-paper hover:bg-paprika hover:border-paprika transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
          <p className="mt-4 text-center text-sm text-stone">
            Already have an account?{' '}
            <Link to="/customer/login" className="underline hover:text-ink">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
