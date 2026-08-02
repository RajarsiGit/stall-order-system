const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';

function signToken(owner) {
  return jwt.sign(
    { ownerId: owner.id, stallId: owner.stall_id, username: owner.username, staffRole: owner.staff_role, role: 'owner' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function signAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, username: admin.username, adminRole: admin.admin_role, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function signCustomerToken(customer) {
  return jwt.sign(
    { customerId: customer.id, email: customer.email, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
    req.owner = payload; // { ownerId, stallId, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.admin = payload; // { adminId, username, adminRole, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireCustomerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'customer') return res.status(403).json({ error: 'Customer access required' });
    req.customer = payload; // { customerId, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireManager(req, res, next) {
  if (req.owner?.staffRole !== 'manager') return res.status(403).json({ error: 'Manager access required' });
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.admin?.adminRole !== 'superadmin') return res.status(403).json({ error: 'Super-admin access required' });
  next();
}

module.exports = {
  signToken,
  signAdminToken,
  signCustomerToken,
  requireAuth,
  requireAdmin,
  requireCustomerAuth,
  requireManager,
  requireSuperAdmin,
  JWT_SECRET,
};
