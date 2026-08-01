import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOwnerAuth } from '../lib/OwnerAuthContext';
import { usePageTitle } from '../lib/usePageTitle';
import logo from '../assets/logo.svg';

export default function OwnerLogin() {
  const { login } = useOwnerAuth();
  const navigate = useNavigate();

  usePageTitle('Stall owner login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate('/owner/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-sm">
        <img src={logo} alt="FoodCourt Hub" className="h-10 w-10" />
        <Link to="/" className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.2em] text-paper/50 hover:text-paper">
          ← Customer side
        </Link>
        <h1 className="mt-3 font-display text-3xl text-paper">Stall owner login</h1>
        <p className="mt-2 text-sm text-paper/60">Manage your incoming orders and menu.</p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label className="block">
            <span className="text-sm font-medium text-paper">Username</span>
            <input
              className="mt-1.5 w-full border-2 border-paper/30 bg-transparent px-3 py-2.5 text-paper focus:border-paprika focus:outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoCapitalize="none"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-paper">Password</span>
            <input
              type="password"
              className="mt-1.5 w-full border-2 border-paper/30 bg-transparent px-3 py-2.5 text-paper focus:border-paprika focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="mt-4 text-sm text-turmeric">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full border-2 border-paprika bg-paprika px-6 py-3 font-medium text-white hover:bg-paprika-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 font-mono text-xs text-paper/40">
          Demo logins: curryhouse / dosacorner / burgerjunction — password: password123
        </p>
      </div>
    </div>
  );
}
