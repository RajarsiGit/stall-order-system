import { useEffect, useRef, useState } from 'react';
import { timeAgo } from '../lib/timeAgo';

export default function NotificationBell({ fetchNotifications, markAllRead }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const pollRef = useRef(null);

  function load() {
    fetchNotifications().then(setNotifications).catch(() => {});
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      load();
    } catch {
      // ignore — next poll will retry
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative border-2 border-ink bg-white px-3 py-1.5 text-sm font-medium hover:bg-ink hover:text-paper transition-colors"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-paper bg-paprika px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] border-2 border-ink bg-white shadow-[6px_6px_0_0_#1c1917]">
          <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-stone">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-stone underline hover:text-ink">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-stone">Nothing yet.</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`border-b border-line px-3 py-2.5 text-sm last:border-b-0 ${
                  n.is_read ? 'text-stone' : 'bg-turmeric-light/40 text-ink'
                }`}
              >
                <p>{n.message}</p>
                <p className="mt-0.5 font-mono text-xs text-stone">{timeAgo(n.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
