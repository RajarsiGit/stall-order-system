# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FoodCourt Hub — a multi-stall food ordering app. Customers create an account, browse stalls,
order, and track a live ticket by order number; stall owners (managers or staff) log in to a
scoped dashboard to watch an order queue, advance order status, and mark payments received —
managers additionally manage the menu, the stall's open/closed state, and staff accounts; a
separate admin login (regular or super-admin) can create new stalls (and their initial owner
credentials) — super-admins can additionally manage other admin accounts. Both customers and
stall owners get in-app notifications (new order → the stall; status change → the customer).

## Commands

This is an npm workspaces monorepo (`client` + `server`); install once from the root.

```bash
npm install                    # installs both workspaces from repo root
```

**Backend** (`server/`, Express + Postgres):
```bash
cd server && npm run dev       # nodemon, http://localhost:4000
cd server && npm start         # node index.js, no reload
```
Requires `server/.env`:
```
PORT=4000
JWT_SECRET=<any random string>
DATABASE_URL=<postgres connection string>
```
The full DB schema lives in `sql/schema.sql` and must be applied manually against the target
database (e.g. `psql $DATABASE_URL -f sql/schema.sql`) — every statement is idempotent, so
re-running it against an already-migrated database is a no-op. `server/db.js` no longer creates
or alters tables, and no longer seeds demo stalls; on first request after startup it only seeds a
demo admin login (`admin` / `admin123`) if the `admins` table is empty, and never in production
(gated on `VERCEL_ENV`/`NODE_ENV === 'production'`). There are no demo stalls, owners, or menu
items by default — create stalls via the admin dashboard (`POST /api/admin/stalls`), or
optionally apply `sql/demo-data.sql` (3 sample stalls with owner logins, password `password123`,
and menu items — idempotent, not run automatically) after `sql/schema.sql`.

**Frontend** (`client/`, Vite + React):
```bash
cd client && npm run dev       # http://localhost:5173, proxies /api/* to :4000 (see vite.config.js)
cd client && npm run build     # production build -> client/dist
cd client && npm run lint      # oxlint
```

There is no test suite in this repo currently.

**Deploying** (Vercel):
```bash
vercel deploy                  # preview
vercel deploy --prod           # production
```
`vercel.json` at the repo root builds the client (`npm run build -w client` -> `client/dist`) and
rewrites `/api/*` to the single serverless function at `api/index.js`. Apply `sql/schema.sql`
against the production database before the first production deploy — the demo-admin auto-seed is
disabled in production, so a first admin login must be created via `sql/demo-data.sql` or by hand.

## Architecture

**Three deployable pieces sharing one Express app:**
- `server/app.js` — the actual Express app: all routes, middleware, error handling. Exports the
  app (no `.listen()` call).
- `server/index.js` — local dev only. Loads `server/.env` and calls `app.listen()`.
- `api/index.js` — Vercel serverless entry. Just `module.exports = require('../server/app')`.

This split exists so the same route code runs unchanged locally (via a long-lived Node process)
and on Vercel (via a stateless function per request). When editing routes, always edit
`server/app.js` — the other two files are just entry points and should stay minimal.

**Database access** (`server/db.js`):
- A `pg.Pool` connected via `DATABASE_URL` (Neon Postgres), reused across warm serverless
  invocations at module scope.
- `ready()` returns a memoized promise that runs demo-data seeding (see `sql/schema.sql` for the
  actual schema) exactly once per warm instance/cold start. `server/app.js` awaits `ready()` in a
  global middleware before handling any request — don't bypass this when adding new routes that
  touch the DB.
- When a change requires a new table/column/index, add it to `sql/schema.sql` (idempotent —
  `IF NOT EXISTS` / matching guards) and tell the user to apply it manually; do not add
  `CREATE TABLE`/`ALTER TABLE` back into `server/db.js`.
- `types.setTypeParser(1700, ...)` is set once at module load so Postgres `NUMERIC` columns come
  back as JS numbers (not strings) everywhere in the app — don't re-parse prices manually.
- Money is stored as `NUMERIC`; booleans (`is_open`, `is_available`, `is_read`) are real Postgres
  `BOOLEAN`.
- Order creation (`POST /api/orders`) and the order status transition
  (`PATCH /api/owner/orders/:orderId/status`) are the multi-statement write paths and run inside
  an explicit `pool.connect()` / `BEGIN` / `COMMIT` transaction (order creation also inserts a
  `stall_notifications` row; status transitions conditionally insert a `customer_notifications`
  row) — follow that pattern for any other multi-row write that must be atomic.

**Auth** (`server/auth.js`) — three separate principal types, all signed with the same
`JWT_SECRET` (the `role` claim is what separates them — if you add a new protected route, always
gate it with `requireAuth`, `requireAdmin`, or `requireCustomerAuth` explicitly rather than
assuming a valid signature implies the right role):
- Stall owners: JWT payload `{ ownerId, stallId, username, staffRole, role: 'owner' }`, signed by
  `signToken`. `requireAuth` middleware attaches `req.owner` and rejects any token whose `role`
  isn't `'owner'`. Every `/api/owner/*` route is scoped to `req.owner.stallId`, so a logged-in
  owner can only ever see or modify their own stall's data — when adding an owner-facing route,
  always filter queries by `req.owner.stallId`, not just by the resource's own id.
  `staffRole` is `'manager'` (full access) or `'staff'` (order queue only — advance status, mark
  payment). `requireManager` middleware (chained after `requireAuth`, never replacing it) gates
  menu CRUD, the stall open/close toggle, and staff-account management to managers only.
  `/api/owner/staff` routes enforce a last-manager guard — a stall can never be left without at
  least one manager.
- Admins: JWT payload `{ adminId, username, adminRole, role: 'admin' }`, signed by
  `signAdminToken`. `requireAdmin` middleware attaches `req.admin` and rejects anything without
  `role === 'admin'`. Admins can create stalls (`POST /api/admin/stalls`, which also creates that
  stall's first owner login — a manager — in the same transaction) and list all stalls
  (`GET /api/admin/stalls`) — they have no route access to any stall's orders or menu.
  `adminRole` is `'admin'` or `'superadmin'`. `requireSuperAdmin` middleware (chained after
  `requireAdmin`) gates admin-account management (`/api/admin/admins`) to super-admins only, with
  a matching last-superadmin guard.
- Customers: JWT payload `{ customerId, email, role: 'customer' }`, signed by
  `signCustomerToken`. `requireCustomerAuth` middleware attaches `req.customer`. Required to place
  an order (`POST /api/orders`) and to view order history/notifications
  (`/api/customer/orders`, `/api/customer/notifications`) — there is no guest checkout.

**Order status machine** (`server/app.js`, `VALID_TRANSITIONS`):
`placed → preparing → ready → handed_over`, with `placed`/`preparing` also able to go to
`cancelled`. Enforced server-side on `PATCH /api/owner/orders/:orderId/status` — invalid jumps
(e.g. `placed → handed_over`) are rejected with 400. Extend `VALID_TRANSITIONS` rather than
special-casing new transitions in the handler. This route runs inside a transaction: moving to
`preparing`/`ready`/`handed_over` also inserts a `customer_notifications` row when the order has a
`customer_id` (skipped for `cancelled`, and for any legacy/guest order with no linked customer).

**Frontend structure** (`client/src/`):
- `lib/api.js` — single fetch wrapper (`api.*` methods); all HTTP calls go through this, base URL
  is always the relative `/api` (works via Vite's dev proxy locally and via Vercel's rewrite in
  prod — no environment-specific API URL config needed). `request()` defaults to the owner token
  unless the caller passes an explicit `token` override — admin and customer calls always do this
  (`token: getAdminToken()` / `token: getCustomerToken()`) — or `skipAuth`.
- `lib/CartContext.jsx` — cart is per-stall in memory (not persisted); switching stalls clears it.
- `lib/OwnerAuthContext.jsx` / `lib/AdminAuthContext.jsx` / `lib/CustomerAuthContext.jsx` —
  mirror-image auth contexts, each with its own `localStorage` key (`owner_token` / `admin_token`
  / `customer_token`) so all three sessions can coexist in the same browser.
- `components/RequireOwnerAuth.jsx` / `RequireAdminAuth.jsx` / `RequireCustomerAuth.jsx` — base
  route guards. `RequireManager.jsx` / `RequireSuperAdmin.jsx` compose on top of the owner/admin
  guards (rather than duplicating the auth check) to additionally require
  `owner.staff_role === 'manager'` / `admin.admin_role === 'superadmin'`, redirecting back to the
  respective dashboard if not.
- `components/NotificationBell.jsx` — shared bell + unread-count + dropdown component used by both
  `OwnerDashboard` (stall-wide shared inbox) and the customer header in `StallList`; takes
  `fetchNotifications`/`markAllRead` as props so one component drives both
  `/api/owner/notifications` and `/api/customer/notifications`. Self-contained 5s poll, same
  pattern as order polling.
- Routes (`App.jsx`): `/` is the split landing page (`Landing.jsx` — customer login/register on
  one side, stall-owner/admin login on the other). The customer stall grid lives at `/stalls`,
  gated by `RequireCustomerAuth` along with `/stall/:stallId`, `/stall/:stallId/checkout`, and
  `/customer/orders`. `/track` and `/order/:orderNumber` remain public (order-number lookup needs
  no login). `/owner/menu` and `/owner/staff` are gated by `RequireManager`; `/admin/admins` by
  `RequireSuperAdmin`.
- Customer order tracking, the owner dashboard, and `NotificationBell` all poll every 5s (no
  websockets/push).

## Notes on scope (intentional, not gaps to "fix" silently)

- Payments are tracked (`pending`/`paid`) but not processed — no real payment gateway.
- No password reset flow for stall owners, admins, or customers.
- Admin can create stalls but has no visibility into any stall's orders/sales — that's
  intentionally still owner-only.
- Notifications are in-app only (polling, no browser push/email/SMS) — see
  `NotificationBell.jsx`.
- A stall's notification read state is shared across all its staff logins (one inbox per stall),
  not tracked per individual login.
