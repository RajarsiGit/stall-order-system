const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');

// Return NUMERIC columns as JS numbers instead of strings.
types.setTypeParser(1700, (val) => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

const SEED = [
  {
    name: 'Curry House',
    description: 'Home-style curries and rice bowls',
    username: 'curryhouse',
    password: 'password123',
    items: [
      ['Chicken Curry Bowl', 'Served with steamed rice', 180],
      ['Paneer Butter Masala', 'With butter naan', 160],
      ['Egg Fried Rice', 'Wok-tossed with veggies', 120],
      ['Masala Chai', 'Hot spiced tea', 30],
    ],
  },
  {
    name: 'Dosa Corner',
    description: 'South Indian classics',
    username: 'dosacorner',
    password: 'password123',
    items: [
      ['Masala Dosa', 'Crispy dosa with potato filling', 90],
      ['Idli Sambar', '4 pieces with sambar & chutney', 70],
      ['Filter Coffee', 'Traditional South Indian coffee', 40],
      ['Rava Upma', 'Semolina upma with veggies', 60],
    ],
  },
  {
    name: 'Burger Junction',
    description: 'Burgers, fries, and shakes',
    username: 'burgerjunction',
    password: 'password123',
    items: [
      ['Classic Cheeseburger', 'Beef patty with cheddar', 150],
      ['Crispy Veg Burger', 'Crispy veg patty, lettuce, mayo', 120],
      ['French Fries', 'Salted, crispy', 80],
      ['Chocolate Shake', 'Thick and creamy', 100],
    ],
  },
];

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stalls (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_open BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS stall_owners (
      id SERIAL PRIMARY KEY,
      stall_id INTEGER NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      stall_id INTEGER NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      status TEXT NOT NULL DEFAULT 'placed',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      total_amount NUMERIC NOT NULL,
      notes TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_orders_stall ON orders(stall_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(stall_id, status);
    CREATE INDEX IF NOT EXISTS idx_menu_stall ON menu_items(stall_id);
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM stalls');
  if (rows[0].c === 0) {
    for (const s of SEED) {
      const { rows: stallRows } = await pool.query(
        'INSERT INTO stalls (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id',
        [s.name, s.description]
      );
      if (stallRows.length === 0) continue; // already seeded by a concurrent cold start

      const stallId = stallRows[0].id;
      const hash = bcrypt.hashSync(s.password, 10);
      await pool.query(
        'INSERT INTO stall_owners (stall_id, username, password_hash) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
        [stallId, s.username, hash]
      );
      for (const [name, description, price] of s.items) {
        await pool.query(
          'INSERT INTO menu_items (stall_id, name, description, price) VALUES ($1, $2, $3, $4)',
          [stallId, name, description, price]
        );
      }
    }
    console.log('Seeded demo data: 3 stalls, each with owner login (password: password123)');
  }

  const { rows: adminRows } = await pool.query('SELECT COUNT(*)::int AS c FROM admins');
  if (adminRows[0].c === 0) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    await pool.query(
      "INSERT INTO admins (username, password_hash) VALUES ('admin', $1) ON CONFLICT (username) DO NOTHING",
      [adminHash]
    );
    console.log('Seeded demo admin login: admin / admin123');
  }
}

// Memoized per warm instance so every request doesn't re-run schema/seed checks.
let readyPromise = null;
function ready() {
  if (!readyPromise) readyPromise = ensureSchema();
  return readyPromise;
}

module.exports = { pool, ready };
