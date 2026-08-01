const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';

function signToken(owner) {
  return jwt.sign(
    { ownerId: owner.id, stallId: owner.stall_id, username: owner.username, role: 'owner' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function signAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, username: admin.username, role: 'admin' },
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
    req.admin = payload; // { adminId, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, signAdminToken, requireAuth, requireAdmin, JWT_SECRET };
