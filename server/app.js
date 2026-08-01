const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { customAlphabet } = require('nanoid');

const { pool, ready } = require('./db');
const { signToken, signAdminToken, requireAuth, requireAdmin } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(async (req, res, next) => {
  await ready();
  next();
});

const genOrderSuffix = customAlphabet('0123456789', 4);

// ---------- Helpers ----------
async function serializeOrder(order) {
  const { rows: items } = await pool.query(
    'SELECT id, item_name, item_price, quantity FROM order_items WHERE order_id = $1',
    [order.id]
  );
  return { ...order, items };
}

const VALID_TRANSITIONS = {
  placed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['handed_over'],
  handed_over: [],
  cancelled: [],
};

// ================= PUBLIC: Stalls & Menu =================

app.get('/api/stalls', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, description, is_open FROM stalls ORDER BY name');
  res.json(rows);
});

app.get('/api/stalls/:stallId/menu', async (req, res) => {
  const { stallId } = req.params;
  const { rows: stallRows } = await pool.query(
    'SELECT id, name, description, is_open FROM stalls WHERE id = $1',
    [stallId]
  );
  const stall = stallRows[0];
  if (!stall) return res.status(404).json({ error: 'Stall not found' });

  const { rows: items } = await pool.query(
    'SELECT id, name, description, price, is_available FROM menu_items WHERE stall_id = $1 ORDER BY name',
    [stallId]
  );

  res.json({ stall, items });
});

// ================= PUBLIC: Orders (customer) =================

app.post('/api/orders', async (req, res) => {
  const { stall_id, customer_name, customer_phone, notes, items } = req.body;

  if (!stall_id || !customer_name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'stall_id, customer_name, and at least one item are required' });
  }

  const { rows: stallRows } = await pool.query('SELECT * FROM stalls WHERE id = $1', [stall_id]);
  const stall = stallRows[0];
  if (!stall) return res.status(404).json({ error: 'Stall not found' });
  if (!stall.is_open) return res.status(400).json({ error: 'This stall is currently closed' });

  // Validate & price items server-side (never trust client prices)
  const menuItemIds = items
    .map((i) => Number(i.menu_item_id))
    .filter((n) => Number.isInteger(n));
  const { rows: dbItems } = await pool.query(
    'SELECT * FROM menu_items WHERE stall_id = $1 AND id = ANY($2::int[])',
    [stall_id, menuItemIds]
  );

  const dbItemMap = new Map(dbItems.map((i) => [i.id, i]));
  let total = 0;
  const resolvedItems = [];

  for (const reqItem of items) {
    const dbItem = dbItemMap.get(reqItem.menu_item_id);
    const qty = parseInt(reqItem.quantity, 10);
    if (!dbItem) return res.status(400).json({ error: `Invalid menu item: ${reqItem.menu_item_id}` });
    if (!dbItem.is_available) return res.status(400).json({ error: `${dbItem.name} is currently unavailable` });
    if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: `Invalid quantity for ${dbItem.name}` });

    total += dbItem.price * qty;
    resolvedItems.push({ menu_item_id: dbItem.id, item_name: dbItem.name, item_price: dbItem.price, quantity: qty });
  }

  const orderNumber = `${stall.name.slice(0, 2).toUpperCase()}-${genOrderSuffix()}`;

  const client = await pool.connect();
  let order;
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, stall_id, customer_name, customer_phone, total_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orderNumber, stall_id, customer_name, customer_phone || null, total, notes || null]
    );
    order = orderRows[0];
    for (const it of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, it.menu_item_id, it.item_name, it.item_price, it.quantity]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json(await serializeOrder(order));
});

// Customer order tracking (public, by order number)
app.get('/api/orders/track/:orderNumber', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE order_number = $1', [req.params.orderNumber]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(await serializeOrder(order));
});

// ================= AUTH (stall owner) =================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const { rows } = await pool.query('SELECT * FROM stall_owners WHERE username = $1', [username]);
  const owner = rows[0];
  if (!owner || !bcrypt.compareSync(password, owner.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const { rows: stallRows } = await pool.query(
    'SELECT id, name, description, is_open FROM stalls WHERE id = $1',
    [owner.stall_id]
  );
  const token = signToken(owner);
  res.json({ token, stall: stallRows[0] });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, description, is_open FROM stalls WHERE id = $1',
    [req.owner.stallId]
  );
  res.json({ owner: { username: req.owner.username }, stall: rows[0] });
});

// ================= STALL OWNER (protected) =================

app.get('/api/owner/orders', requireAuth, async (req, res) => {
  const { status } = req.query;
  let rows;
  if (status) {
    ({ rows } = await pool.query(
      'SELECT * FROM orders WHERE stall_id = $1 AND status = $2 ORDER BY created_at ASC',
      [req.owner.stallId, status]
    ));
  } else {
    ({ rows } = await pool.query(
      "SELECT * FROM orders WHERE stall_id = $1 AND status != 'handed_over' AND status != 'cancelled' ORDER BY created_at ASC",
      [req.owner.stallId]
    ));
  }
  res.json(await Promise.all(rows.map(serializeOrder)));
});

app.get('/api/owner/orders/history', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM orders WHERE stall_id = $1 AND (status = 'handed_over' OR status = 'cancelled') ORDER BY created_at DESC LIMIT 100",
    [req.owner.stallId]
  );
  res.json(await Promise.all(rows.map(serializeOrder)));
});

app.patch('/api/owner/orders/:orderId/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1 AND stall_id = $2', [
    req.params.orderId,
    req.owner.stallId,
  ]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Cannot move order from '${order.status}' to '${status}'` });
  }

  await pool.query("UPDATE orders SET status = $1, updated_at = now() WHERE id = $2", [status, order.id]);
  const { rows: updatedRows } = await pool.query('SELECT * FROM orders WHERE id = $1', [order.id]);
  res.json(await serializeOrder(updatedRows[0]));
});

app.patch('/api/owner/orders/:orderId/payment', requireAuth, async (req, res) => {
  const { payment_status } = req.body;
  if (!['pending', 'paid'].includes(payment_status)) {
    return res.status(400).json({ error: "payment_status must be 'pending' or 'paid'" });
  }
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1 AND stall_id = $2', [
    req.params.orderId,
    req.owner.stallId,
  ]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });

  await pool.query("UPDATE orders SET payment_status = $1, updated_at = now() WHERE id = $2", [
    payment_status,
    order.id,
  ]);
  const { rows: updatedRows } = await pool.query('SELECT * FROM orders WHERE id = $1', [order.id]);
  res.json(await serializeOrder(updatedRows[0]));
});

// Menu management
app.get('/api/owner/menu', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE stall_id = $1 ORDER BY name', [
    req.owner.stallId,
  ]);
  res.json(rows);
});

app.post('/api/owner/menu', requireAuth, async (req, res) => {
  const { name, description, price } = req.body;
  if (!name || price == null || isNaN(price)) return res.status(400).json({ error: 'name and price are required' });

  const { rows } = await pool.query(
    'INSERT INTO menu_items (stall_id, name, description, price) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.owner.stallId, name, description || null, parseFloat(price)]
  );

  res.status(201).json(rows[0]);
});

app.patch('/api/owner/menu/:itemId', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE id = $1 AND stall_id = $2', [
    req.params.itemId,
    req.owner.stallId,
  ]);
  const item = rows[0];
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  const { name, description, price, is_available } = req.body;
  const { rows: updatedRows } = await pool.query(
    `UPDATE menu_items SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      price = COALESCE($3, price),
      is_available = COALESCE($4, is_available)
    WHERE id = $5 RETURNING *`,
    [
      name ?? null,
      description ?? null,
      price != null ? parseFloat(price) : null,
      is_available != null ? Boolean(is_available) : null,
      item.id,
    ]
  );

  res.json(updatedRows[0]);
});

app.delete('/api/owner/menu/:itemId', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE id = $1 AND stall_id = $2', [
    req.params.itemId,
    req.owner.stallId,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Menu item not found' });
  await pool.query('DELETE FROM menu_items WHERE id = $1', [rows[0].id]);
  res.status(204).send();
});

// Stall open/closed toggle
app.patch('/api/owner/stall', requireAuth, async (req, res) => {
  const { is_open } = req.body;
  await pool.query('UPDATE stalls SET is_open = $1 WHERE id = $2', [Boolean(is_open), req.owner.stallId]);
  const { rows } = await pool.query(
    'SELECT id, name, description, is_open FROM stalls WHERE id = $1',
    [req.owner.stallId]
  );
  res.json(rows[0]);
});

// ================= AUTH (admin) =================

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
  const admin = rows[0];
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signAdminToken(admin);
  res.json({ token, admin: { username: admin.username } });
});

app.get('/api/admin/me', requireAdmin, async (req, res) => {
  res.json({ admin: { username: req.admin.username } });
});

// ================= ADMIN (protected) =================

app.get('/api/admin/stalls', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.description, s.is_open, s.created_at, o.username AS owner_username
     FROM stalls s
     LEFT JOIN stall_owners o ON o.stall_id = s.id
     ORDER BY s.name`
  );
  res.json(rows);
});

app.post('/api/admin/stalls', requireAdmin, async (req, res) => {
  const { name, description, owner_username, owner_password } = req.body;

  if (!name?.trim() || !owner_username?.trim() || !owner_password) {
    return res.status(400).json({ error: 'name, owner_username, and owner_password are required' });
  }
  if (owner_password.length < 6) {
    return res.status(400).json({ error: 'owner_password must be at least 6 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: stallRows } = await client.query(
      'INSERT INTO stalls (name, description) VALUES ($1, $2) RETURNING id, name, description, is_open',
      [name.trim(), description?.trim() || null]
    );
    const stall = stallRows[0];

    const hash = bcrypt.hashSync(owner_password, 10);
    await client.query('INSERT INTO stall_owners (stall_id, username, password_hash) VALUES ($1, $2, $3)', [
      stall.id,
      owner_username.trim(),
      hash,
    ]);

    await client.query('COMMIT');
    res.status(201).json({ ...stall, owner_username: owner_username.trim() });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const field = err.constraint?.includes('username') ? 'owner_username' : 'stall name';
      return res.status(400).json({ error: `That ${field} is already taken` });
    }
    throw err;
  } finally {
    client.release();
  }
});

// ---------- Health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- Errors ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
