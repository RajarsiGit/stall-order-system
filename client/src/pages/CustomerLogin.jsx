import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../lib/CustomerAuthContext';
import { usePageTitle } from '../lib/usePageTitle';
import logo from '../assets/logo.svg';

export default function CustomerLogin() {
  const { login } = useCustomerAuth();
  const navigate = useNavigate();

  usePageTitle('Log in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate('/stalls', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <img src={logo} alt="FoodCourt Hub" className="h-10 w-10" />
        <Link to="/" className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.2em] text-stone hover:text-ink">
          ← Back
        </Link>
        <h1 className="mt-3 font-display text-3xl">Log in</h1>
        <p className="mt-2 text-sm text-stone">Order from any stall and track your history.</p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoCapitalize="none"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              className="mt-1.5 w-full border-2 border-ink bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-paprika"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="mt-4 text-sm text-paprika-dark">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full border-2 border-ink bg-ink px-6 py-3 font-medium text-paper hover:bg-paprika hover:border-paprika transition-colors disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-4 text-center text-sm text-stone">
            New here?{' '}
            <Link to="/customer/register" className="underline hover:text-ink">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
