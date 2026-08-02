# FoodCourt Hub

A multi-stall food ordering app: customers create an account, browse stalls, order, and
track a live ticket; stall owners (managers or staff) watch an order queue, update status,
and mark payments received; a separate admin role manages stalls and, for super-admins,
other admin accounts. Both customers and stall owners get in-app notifications.

## Stack

- **Backend**: Node.js + Express, Postgres (Neon) via `pg`, JWT auth for three separate
  principal types (customers, stall owners, admins)
- **Frontend**: React + Vite + Tailwind CSS v4, React Router
- Deployed on Vercel: the frontend is a static build, the backend runs as a single
  serverless function (`api/index.js`) behind an `/api/*` rewrite.

## Project layout

```
api/      Vercel serverless entry point — re-exports the Express app
server/   Express app (server/app.js) + Postgres data layer (server/db.js)
client/   React frontend (customer, stall-owner, and admin interfaces)
sql/      Database schema (schema.sql) and optional demo data (demo-data.sql)
```

This is an npm workspaces monorepo (root `package.json`), so dependencies for
both `client` and `server` install together from the repo root.

## Running locally

You need a Postgres database (a free [Neon](https://neon.tech) project works well)
and two terminals — one for the API, one for the frontend.

**0. One-time setup**
```bash
npm install                    # installs client + server workspaces
```
Create `server/.env` with:
```
PORT=4000
JWT_SECRET=<any random string>
DATABASE_URL=<your Postgres connection string>
```
Apply the schema — the app no longer creates tables automatically:
```bash
psql $DATABASE_URL -f sql/schema.sql
psql $DATABASE_URL -f sql/demo-data.sql   # optional: 3 sample stalls, menus, and owner logins
```

**1. Start the backend**
```bash
cd server
npm run dev        # or: npm start
```
Runs on `http://localhost:4000`. On first request it seeds a demo admin login
(`admin` / `admin123`) if the `admins` table is empty — but never in production
(see Deploying below).

**2. Start the frontend**
```bash
cd client
npm run dev
```
Runs on `http://localhost:5173` (Vite proxies `/api/*` to port 4000 — see
`client/vite.config.js`).

Open `http://localhost:5173` — it's a split landing page: customer login/register
on the left, stall-owner and admin login on the right.

## Deploying to Vercel

```bash
vercel link                    # first time only
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add JWT_SECRET production
vercel env add JWT_SECRET preview
psql $PROD_DATABASE_URL -f sql/schema.sql   # apply schema before the first deploy
vercel deploy                  # preview
vercel deploy --prod           # production
```

`vercel.json` builds the client with `npm run build -w client` and serves the
API from `api/index.js` (the same Express app used locally), with `/api/*`
requests rewritten to that one function.

The demo-admin auto-seed never runs in production (`VERCEL_ENV === 'production'`), so
you'll need to create your first admin login yourself — apply `sql/demo-data.sql` for
the sample credentials below, or insert an `admins` row by hand with a bcrypt-hashed
password.

## Demo logins

The admin login is auto-seeded on an empty `admins` table (non-production only —
change it before any real deployment). Stall-owner logins are not seeded automatically;
apply `sql/demo-data.sql` for the sample logins below, and register customer accounts
through the app itself.

**Admin** (auto-seeded outside production): `admin` / `admin123` — this account is a
super-admin, so it can also create additional admin accounts.

**Stall owners** (only if `sql/demo-data.sql` is applied), each a manager scoped to
their own stall:

| Stall           | Username         | Password    |
|-----------------|------------------|-------------|
| Curry House     | `curryhouse`     | `password123` |
| Dosa Corner     | `dosacorner`     | `password123` |
| Burger Junction | `burgerjunction` | `password123` |

**Customers**: no seeded accounts — register via "New here? Register" on the landing page.

## How it works

**Customer flow**
1. Register or log in with email + password — an account is required to order, there's
   no guest checkout
2. Browse open stalls → pick a stall → browse its menu
3. Add items to cart (cart is per-stall; switching stalls clears it)
4. Checkout: add optional notes only — name and phone come from your account, not a form
5. Get an order number (e.g. `CU-0191`) and land on a tracking page
6. Tracking page polls every 5s and shows status: placed → preparing → ready → handed over, plus payment status
7. An in-app notification bell (polling every 5s) alerts you as your order's status changes
8. "Your orders" shows your full order history

**Stall owner flow**
1. Log in (scoped to their stall only). Each stall can have multiple logins, in two tiers:
   - **Manager** — full access: order queue, menu, stall open/close toggle, and managing
     the stall's staff accounts
   - **Staff** — order queue only: advance status, mark payment received; no menu, settings,
     or staff access
2. Dashboard shows three live columns: New orders / Preparing / Ready — polls every 5s
3. Advance each order through its status with one click; cancel new orders if needed
4. Mark payment received per order (tracked, not processed — no real payment gateway)
5. Managers only: manage menu items (add/remove, toggle availability), toggle the stall
   open/closed, and add/remove staff accounts — a stall always keeps at least one manager
6. A shared notification bell alerts the whole stall (one inbox per stall, not per login)
   when a new order lands

**Admin flow**
1. Log in at `/admin/login` (separate login, not tied to any stall). Two tiers:
   - **Super-admin** — create stalls, and create/manage other admin accounts
   - **Admin** — create stalls only (the original scope)
2. See every stall in the food court and add a new one — name, description, and an initial
   owner (manager) username/password for it, created in one step
3. Admins can't see or manage any stall's orders/menu — that stays with the stall owner login
4. The system always keeps at least one super-admin — the last one can't be demoted or removed

## Data model

- `stalls` — name, description, open/closed
- `stall_owners` — login credentials scoped to one stall, plus `staff_role` (`manager`/`staff`)
- `admins` — login credentials for the separate admin role, plus `admin_role` (`admin`/`superadmin`)
- `customers` — customer account credentials (email/password), name, phone
- `menu_items` — per stall, with availability toggle
- `orders` — order number, linked customer, status, payment status, total
- `order_items` — line items per order (price captured at order time, so later menu price changes don't retroactively change past orders)
- `stall_notifications` — shared per-stall inbox (e.g. "new order placed")
- `customer_notifications` — per-customer inbox (e.g. "order status changed")

Order status transitions are enforced server-side
(`placed → preparing → ready → handed_over`, or `placed/preparing → cancelled`)
so the API rejects invalid jumps (e.g. `placed → handed_over`). Advancing an order to
`preparing`, `ready`, or `handed_over` also drops a notification for the customer, if the
order has a linked account.

The full schema (idempotent `IF NOT EXISTS` guards throughout) lives in `sql/schema.sql`
and must be applied manually — the app no longer creates or alters tables itself.

## Notes on "real" vs. demo scope

- **Payments**: tracked as `pending`/`paid` only — there's no payment gateway integration. The stall owner marks orders paid manually.
- **Notifications**: in-app only (a bell icon with an unread count, polling every 5s) — no browser push, email, or SMS.
- **Auth**: JWT-based, 12-hour expiry, passwords hashed with bcrypt, three separate principal types (customer/owner/admin) sharing one `JWT_SECRET`. Fine for a real small-scale deployment; if you're going to production with real money/customers, put this behind HTTPS and rotate `JWT_SECRET`.
- **Database**: Postgres (Neon), via a thin `db.js` layer — needed because Vercel's serverless functions have no persistent local disk, so a SQLite-file approach couldn't survive a deploy there. Schema changes are applied manually via `sql/schema.sql`, not auto-migrated by the app.

## Next steps you might want

- Password reset for stall owners, admins, and customers
- Admin visibility into orders/sales across all stalls (today admin can only create stalls, not view their activity)
- Basic sales reporting per stall
- Browser push, sound, or email/SMS notifications (today's notifications are in-app only)
- QR code per stall linking straight to its menu
