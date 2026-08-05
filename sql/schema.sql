-- FoodCourt Hub — full database schema.
--
-- Applied manually against the target database (not run automatically by the app —
-- server/db.js only seeds demo data on top of this, it no longer creates or alters
-- tables). Safe to re-run: every statement is idempotent (IF NOT EXISTS / matching
-- guards), so re-applying against an already-migrated database is a no-op.

CREATE TABLE IF NOT EXISTS stalls (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- staff_role: 'manager' (full stall access, incl. managing staff) | 'staff' (order
-- queue only). Every pre-existing owner login defaults to 'manager'.
CREATE TABLE IF NOT EXISTS stall_owners (
  id SERIAL PRIMARY KEY,
  stall_id INTEGER NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  staff_role TEXT NOT NULL DEFAULT 'manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_role: 'superadmin' (can manage other admin accounts) | 'admin' (today's
-- scope — create/list stalls only). Ensure at least one 'superadmin' row exists
-- after applying this schema to a database with existing admins (see backfill below).
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  admin_role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  stall_id INTEGER NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- customer_id is nullable (ON DELETE SET NULL) so historical guest orders (placed
-- before customer accounts existed) remain valid.
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  stall_id INTEGER NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'placed',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC NOT NULL,
  notes TEXT,
  pickup_pin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL
);

-- Shared per-stall notification inbox (read/unread is not tracked per staff login).
CREATE TABLE IF NOT EXISTS stall_notifications (
  id SERIAL PRIMARY KEY,
  stall_id INTEGER NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_notifications (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_stall ON orders(stall_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(stall_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_menu_stall ON menu_items(stall_id);
CREATE INDEX IF NOT EXISTS idx_stall_notif_stall ON stall_notifications(stall_id, is_read);
CREATE INDEX IF NOT EXISTS idx_customer_notif_cust ON customer_notifications(customer_id, is_read);

-- Ensure at least one super-admin exists. No-op once any row already has
-- admin_role = 'superadmin' — never re-promotes a deliberately-demoted admin.
UPDATE admins SET admin_role = 'superadmin'
WHERE admin_role != 'superadmin'
  AND id = (SELECT MIN(id) FROM admins)
  AND NOT EXISTS (SELECT 1 FROM admins WHERE admin_role = 'superadmin');
