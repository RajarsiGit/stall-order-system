const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { customAlphabet } = require('nanoid');

const { pool, ready } = require('./db');
const {
  signToken,
  signAdminToken,
  signCustomerToken,
  requireAuth,
  requireAdmin,
  requireCustomerAuth,
  requireManager,
  requireSuperAdmin,
} = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(async (req, res, next) => {
  await ready();
  next();
});

const genOrderSuffix = customAlphabet('0123456789', 4);
const genPickupPin = customAlphabet('0123456789', 4);

// ---------- Helpers ----------
// pickup_pin is only ever surfaced to the customer who placed the order — owner-facing
// responses omit it (includePin: false, the default) so the stall must ask the customer
// for it rather than reading it off their own queue.
async function serializeOrder(order, { includePin = false } = {}) {
  const { rows: items } = await pool.query(
    'SELECT id, item_name, item_price, quantity FROM order_items WHERE order_id = $1',
    [order.id]
  );
  const { pickup_pin, ...rest } = order;
  return { ...rest, ...(includePin ? { pickup_pin } : {}), items };
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

// ================= CUSTOMER: Orders =================

app.post('/api/orders', requireCustomerAuth, async (req, res) => {
  const { stall_id, notes, items } = req.body;

  if (!stall_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'stall_id and at least one item are required' });
  }

  const { rows: customerRows } = await pool.query('SELECT * FROM customers WHERE id = $1', [
    req.customer.customerId,
  ]);
  const customer = customerRows[0];
  if (!customer) return res.status(401).json({ error: 'Customer account not found' });

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
  const pickupPin = genPickupPin();

  const client = await pool.connect();
  let order;
  try {
    await client.query('BEGIN');
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, stall_id, customer_id, customer_name, customer_phone, total_amount, notes, pickup_pin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [orderNumber, stall_id, customer.id, customer.name, customer.phone || null, total, notes || null, pickupPin]
    );
    order = orderRows[0];
    for (const it of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, it.menu_item_id, it.item_name, it.item_price, it.quantity]
      );
    }
    await client.query(
      `INSERT INTO stall_notifications (stall_id, order_id, message) VALUES ($1, $2, $3)`,
      [stall_id, order.id, `New order ${orderNumber} from ${customer.name}`]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json(await serializeOrder(order, { includePin: true }));
});

// Customer order tracking (public, by order number)
app.get('/api/orders/track/:orderNumber', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE order_number = $1', [req.params.orderNumber]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(await serializeOrder(order, { includePin: true }));
});

// ================= AUTH (customer) =================

app.post('/api/customer/register', async (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email?.trim() || !password || !name?.trim()) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  const hash = bcrypt.hashSync(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO customers (email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING *',
      [email.trim().toLowerCase(), hash, name.trim(), phone?.trim() || null]
    );
    const customer = rows[0];
    const token = signCustomerToken(customer);
    res.status(201).json({ token, customer: { email: customer.email, name: customer.name, phone: customer.phone } });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'That email is already registered' });
    throw err;
  }
});

app.post('/api/customer/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { rows } = await pool.query('SELECT * FROM customers WHERE email = $1', [email.trim().toLowerCase()]);
  const customer = rows[0];
  if (!customer || !bcrypt.compareSync(password, customer.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signCustomerToken(customer);
  res.json({ token, customer: { email: customer.email, name: customer.name, phone: customer.phone } });
});

app.get('/api/customer/me', requireCustomerAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT email, name, phone FROM customers WHERE id = $1', [
    req.customer.customerId,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer: rows[0] });
});

app.get('/api/customer/orders', requireCustomerAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 100',
    [req.customer.customerId]
  );
  res.json(await Promise.all(rows.map((o) => serializeOrder(o, { includePin: true }))));
});

app.get('/api/customer/notifications', requireCustomerAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM customer_notifications WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.customer.customerId]
  );
  res.json(rows);
});

app.post('/api/customer/notifications/read-all', requireCustomerAuth, async (req, res) => {
  await pool.query('UPDATE customer_notifications SET is_read = true WHERE customer_id = $1', [
    req.customer.customerId,
  ]);
  res.status(204).send();
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
  res.json({ token, stall: stallRows[0], owner: { username: owner.username, staff_role: owner.staff_role } });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, description, is_open FROM stalls WHERE id = $1',
    [req.owner.stallId]
  );
  res.json({ owner: { username: req.owner.username, staff_role: req.owner.staffRole }, stall: rows[0] });
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

const CUSTOMER_NOTIFY_STATUSES = ['preparing', 'ready', 'handed_over'];
const STATUS_MESSAGE = {
  preparing: (orderNumber) => `Your order ${orderNumber} is being prepared`,
  ready: (orderNumber) => `Your order ${orderNumber} is ready for pickup`,
  handed_over: (orderNumber) => `Your order ${orderNumber} has been handed over`,
};

app.patch('/api/owner/orders/:orderId/status', requireAuth, async (req, res) => {
  const { status, pin } = req.body;
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

  // order.pickup_pin is null for legacy orders placed before this feature existed —
  // those skip verification since the customer was never issued a PIN.
  if (status === 'handed_over' && order.pickup_pin) {
    if (!pin || pin.trim() !== order.pickup_pin) {
      return res.status(400).json({ error: 'Incorrect pickup PIN' });
    }
  }

  const client = await pool.connect();
  let updatedOrder;
  try {
    await client.query('BEGIN');
    const { rows: updatedRows } = await client.query(
      'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [status, order.id]
    );
    updatedOrder = updatedRows[0];
    if (order.customer_id && CUSTOMER_NOTIFY_STATUSES.includes(status)) {
      await client.query(
        'INSERT INTO customer_notifications (customer_id, order_id, message) VALUES ($1, $2, $3)',
        [order.customer_id, order.id, STATUS_MESSAGE[status](order.order_number)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(await serializeOrder(updatedOrder));
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

// Notifications (shared per-stall inbox)
app.get('/api/owner/notifications', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM stall_notifications WHERE stall_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.owner.stallId]
  );
  res.json(rows);
});

app.post('/api/owner/notifications/read-all', requireAuth, async (req, res) => {
  await pool.query('UPDATE stall_notifications SET is_read = true WHERE stall_id = $1', [req.owner.stallId]);
  res.status(204).send();
});

// Staff management (manager only)
app.get('/api/owner/staff', requireAuth, requireManager, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, staff_role, created_at FROM stall_owners WHERE stall_id = $1 ORDER BY created_at ASC',
    [req.owner.stallId]
  );
  res.json(rows);
});

app.post('/api/owner/staff', requireAuth, requireManager, async (req, res) => {
  const { username, password, staff_role } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  const role = staff_role === 'manager' ? 'manager' : 'staff';

  const hash = bcrypt.hashSync(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO stall_owners (stall_id, username, password_hash, staff_role) VALUES ($1, $2, $3, $4) RETURNING id, username, staff_role, created_at',
      [req.owner.stallId, username.trim(), hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'That username is already taken' });
    throw err;
  }
});

app.patch('/api/owner/staff/:staffId', requireAuth, requireManager, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM stall_owners WHERE id = $1 AND stall_id = $2', [
    req.params.staffId,
    req.owner.stallId,
  ]);
  const staff = rows[0];
  if (!staff) return res.status(404).json({ error: 'Staff account not found' });

  const { staff_role } = req.body;
  if (!['manager', 'staff'].includes(staff_role)) {
    return res.status(400).json({ error: "staff_role must be 'manager' or 'staff'" });
  }

  if (staff.staff_role === 'manager' && staff_role === 'staff') {
    const { rows: managerRows } = await pool.query(
      "SELECT COUNT(*)::int AS c FROM stall_owners WHERE stall_id = $1 AND staff_role = 'manager'",
      [req.owner.stallId]
    );
    if (managerRows[0].c <= 1) {
      return res.status(400).json({ error: 'Cannot demote the last manager for this stall' });
    }
  }

  const { rows: updatedRows } = await pool.query(
    'UPDATE stall_owners SET staff_role = $1 WHERE id = $2 RETURNING id, username, staff_role, created_at',
    [staff_role, staff.id]
  );
  res.json(updatedRows[0]);
});

app.delete('/api/owner/staff/:staffId', requireAuth, requireManager, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM stall_owners WHERE id = $1 AND stall_id = $2', [
    req.params.staffId,
    req.owner.stallId,
  ]);
  const staff = rows[0];
  if (!staff) return res.status(404).json({ error: 'Staff account not found' });

  if (staff.staff_role === 'manager') {
    const { rows: managerRows } = await pool.query(
      "SELECT COUNT(*)::int AS c FROM stall_owners WHERE stall_id = $1 AND staff_role = 'manager'",
      [req.owner.stallId]
    );
    if (managerRows[0].c <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last manager for this stall' });
    }
  }

  await pool.query('DELETE FROM stall_owners WHERE id = $1', [staff.id]);
  res.status(204).send();
});

// Menu management (manager only)
app.get('/api/owner/menu', requireAuth, requireManager, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE stall_id = $1 ORDER BY name', [
    req.owner.stallId,
  ]);
  res.json(rows);
});

app.post('/api/owner/menu', requireAuth, requireManager, async (req, res) => {
  const { name, description, price } = req.body;
  if (!name || price == null || isNaN(price)) return res.status(400).json({ error: 'name and price are required' });

  const { rows } = await pool.query(
    'INSERT INTO menu_items (stall_id, name, description, price) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.owner.stallId, name, description || null, parseFloat(price)]
  );

  res.status(201).json(rows[0]);
});

app.patch('/api/owner/menu/:itemId', requireAuth, requireManager, async (req, res) => {
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

app.delete('/api/owner/menu/:itemId', requireAuth, requireManager, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE id = $1 AND stall_id = $2', [
    req.params.itemId,
    req.owner.stallId,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Menu item not found' });
  await pool.query('DELETE FROM menu_items WHERE id = $1', [rows[0].id]);
  res.status(204).send();
});

// Stall open/closed toggle (manager only)
app.patch('/api/owner/stall', requireAuth, requireManager, async (req, res) => {
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
  res.json({ token, admin: { username: admin.username, admin_role: admin.admin_role } });
});

app.get('/api/admin/me', requireAdmin, async (req, res) => {
  res.json({ admin: { username: req.admin.username, admin_role: req.admin.adminRole } });
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

// Admin account management (super-admin only)
app.get('/api/admin/admins', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, admin_role, created_at FROM admins ORDER BY created_at ASC'
  );
  res.json(rows);
});

app.post('/api/admin/admins', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { username, password, admin_role } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  const role = admin_role === 'superadmin' ? 'superadmin' : 'admin';

  const hash = bcrypt.hashSync(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO admins (username, password_hash, admin_role) VALUES ($1, $2, $3) RETURNING id, username, admin_role, created_at',
      [username.trim(), hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'That username is already taken' });
    throw err;
  }
});

app.patch('/api/admin/admins/:adminId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [req.params.adminId]);
  const targetAdmin = rows[0];
  if (!targetAdmin) return res.status(404).json({ error: 'Admin not found' });

  const { admin_role } = req.body;
  if (!['admin', 'superadmin'].includes(admin_role)) {
    return res.status(400).json({ error: "admin_role must be 'admin' or 'superadmin'" });
  }

  if (targetAdmin.admin_role === 'superadmin' && admin_role === 'admin') {
    const { rows: superRows } = await pool.query(
      "SELECT COUNT(*)::int AS c FROM admins WHERE admin_role = 'superadmin'"
    );
    if (superRows[0].c <= 1) {
      return res.status(400).json({ error: 'Cannot demote the last super-admin' });
    }
  }

  const { rows: updatedRows } = await pool.query(
    'UPDATE admins SET admin_role = $1 WHERE id = $2 RETURNING id, username, admin_role, created_at',
    [admin_role, targetAdmin.id]
  );
  res.json(updatedRows[0]);
});

app.delete('/api/admin/admins/:adminId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [req.params.adminId]);
  const targetAdmin = rows[0];
  if (!targetAdmin) return res.status(404).json({ error: 'Admin not found' });

  if (targetAdmin.admin_role === 'superadmin') {
    const { rows: superRows } = await pool.query(
      "SELECT COUNT(*)::int AS c FROM admins WHERE admin_role = 'superadmin'"
    );
    if (superRows[0].c <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last super-admin' });
    }
  }

  await pool.query('DELETE FROM admins WHERE id = $1', [targetAdmin.id]);
  res.status(204).send();
});

// ---------- Health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- Errors ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
