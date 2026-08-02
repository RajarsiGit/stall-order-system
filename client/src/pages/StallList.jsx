import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useCustomerAuth } from '../lib/CustomerAuthContext';
import { usePageTitle } from '../lib/usePageTitle';
import NotificationBell from '../components/NotificationBell';
import logo from '../assets/logo.svg';

export default function StallList() {
  const { customer, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [stalls, setStalls] = useState(null);
  const [error, setError] = useState('');

  usePageTitle('Order from local food stalls');

  useEffect(() => {
    api
      .getStalls()
      .then(setStalls)
      .catch((e) => setError(e.message));
  }, []);

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-2 border-ink px-6 py-8 md:px-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="" className="h-9 w-9 md:h-11 md:w-11" />
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone">Now serving</p>
            </div>
            <h1 className="mt-2 font-display text-4xl md:text-6xl leading-none">FoodCourt Hub</h1>
            <p className="mt-3 max-w-md text-stone">
              Pick a stall, build your order, and we'll print you a ticket number to track.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-stone">Hi, {customer?.name}</p>
            <Link to="/customer/orders" className="text-sm text-stone underline decoration-line hover:text-ink">
              Your orders
            </Link>
            <NotificationBell
              fetchNotifications={api.getCustomerNotifications}
              markAllRead={api.markCustomerNotificationsRead}
            />
            <button onClick={handleLogout} className="text-sm text-stone underline decoration-line hover:text-ink">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-10 md:px-12">
        {error && (
          <div className="mb-6 border-2 border-paprika bg-paprika/10 px-4 py-3 text-paprika-dark">
            Couldn't load stalls: {error}
          </div>
        )}

        {!stalls && !error && <p className="text-stone">Loading stalls…</p>}

        {stalls && stalls.length === 0 && (
          <p className="text-stone">No stalls are set up yet. Check back soon.</p>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stalls?.map((stall, i) => (
            <Link
              key={stall.id}
              to={stall.is_open ? `/stall/${stall.id}` : '#'}
              className={`group relative border-2 border-ink bg-white px-6 py-6 transition-transform ${
                stall.is_open ? 'hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#1c1917]' : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={(e) => !stall.is_open && e.preventDefault()}
            >
              <span className="font-mono text-xs text-stone">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="mt-1 font-display text-2xl leading-tight">{stall.name}</h2>
              {stall.description && <p className="mt-2 text-sm text-stone">{stall.description}</p>}
              <div className="mt-4">
                {stall.is_open ? (
                  <span className="inline-flex items-center gap-1.5 border border-herb bg-herb-light px-2.5 py-1 text-xs font-medium text-herb">
                    <span className="h-1.5 w-1.5 rounded-full bg-herb" /> Open now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 border border-stone bg-stone-light px-2.5 py-1 text-xs font-medium text-stone">
                    Closed
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="mt-10 border-t border-line px-6 py-6 md:px-12">
        <Link to="/track" className="text-sm text-stone underline decoration-line hover:text-ink">
          Already ordered? Track your ticket →
        </Link>
      </footer>
    </div>
  );
}
