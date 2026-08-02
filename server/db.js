const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');

// Return NUMERIC columns as JS numbers instead of strings.
types.setTypeParser(1700, (val) => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

// Schema (tables, columns, indexes) lives in sql/schema.sql and is applied
// manually against the target database — this only seeds a demo admin login on
// top of an already-migrated schema. Never runs in production: a hardcoded
// admin/admin123 login must not be auto-created there.
async function seedDemoData() {
  if (isProduction) return;

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

// Memoized per warm instance so every request doesn't re-run the seed check.
let readyPromise = null;
function ready() {
  if (!readyPromise) readyPromise = seedDemoData();
  return readyPromise;
}

module.exports = { pool, ready };
