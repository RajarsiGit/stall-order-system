-- Optional demo data — 3 sample stalls with owner logins and menu items.
-- Not run automatically (server/db.js only auto-seeds a demo admin login). Apply
-- this by hand against an empty database if you want something to click through:
--   psql $DATABASE_URL -f sql/schema.sql -f sql/demo-data.sql
--
-- All 3 owner logins use the password: password123
-- (bcrypt hash below is that password at cost factor 10)

INSERT INTO stalls (name, description) VALUES
  ('Curry House', 'Home-style curries and rice bowls'),
  ('Dosa Corner', 'South Indian classics'),
  ('Burger Junction', 'Burgers, fries, and shakes')
ON CONFLICT (name) DO NOTHING;

INSERT INTO stall_owners (stall_id, username, password_hash)
SELECT s.id, o.username, '$2b$10$FX8AqnrjpaLk/j6ezJLLEOT8fEsR1rTpYpKCi1XEb.MZ1A.kkUe2O'
FROM (VALUES
  ('Curry House', 'curryhouse'),
  ('Dosa Corner', 'dosacorner'),
  ('Burger Junction', 'burgerjunction')
) AS o(stall_name, username)
JOIN stalls s ON s.name = o.stall_name
ON CONFLICT (username) DO NOTHING;

INSERT INTO menu_items (stall_id, name, description, price)
SELECT s.id, m.name, m.description, m.price
FROM (VALUES
  ('Curry House', 'Chicken Curry Bowl', 'Served with steamed rice', 180),
  ('Curry House', 'Paneer Butter Masala', 'With butter naan', 160),
  ('Curry House', 'Egg Fried Rice', 'Wok-tossed with veggies', 120),
  ('Curry House', 'Masala Chai', 'Hot spiced tea', 30),
  ('Dosa Corner', 'Masala Dosa', 'Crispy dosa with potato filling', 90),
  ('Dosa Corner', 'Idli Sambar', '4 pieces with sambar & chutney', 70),
  ('Dosa Corner', 'Filter Coffee', 'Traditional South Indian coffee', 40),
  ('Dosa Corner', 'Rava Upma', 'Semolina upma with veggies', 60),
  ('Burger Junction', 'Classic Cheeseburger', 'Beef patty with cheddar', 150),
  ('Burger Junction', 'Crispy Veg Burger', 'Crispy veg patty, lettuce, mayo', 120),
  ('Burger Junction', 'French Fries', 'Salted, crispy', 80),
  ('Burger Junction', 'Chocolate Shake', 'Thick and creamy', 100)
) AS m(stall_name, name, description, price)
JOIN stalls s ON s.name = m.stall_name
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items existing WHERE existing.stall_id = s.id AND existing.name = m.name
);
