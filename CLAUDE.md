# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FoodCourt Hub — a multi-stall food ordering app. Customers browse stalls, order, and track a
live ticket by order number (no account needed); stall owners log in to a scoped dashboard to
watch an order queue, advance order status, mark payments received, and manage their menu.

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
On first request after startup, `server/db.js` runs `CREATE TABLE IF NOT EXISTS` for the whole
schema and seeds 3 demo stalls (with owner logins, password `password123`) if the `stalls` table
is empty — there is no separate migration/seed script to run.

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
rewrites `/api/*` to the single serverless function at `api/index.js`.

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
- `ready()` returns a memoized promise that runs `CREATE TABLE IF NOT EXISTS` + demo-data seeding
  exactly once per warm instance/cold start. `server/app.js` awaits `ready()` in a global
  middleware before handling any request — don't bypass this when adding new routes that touch
  the DB.
- `types.setTypeParser(1700, ...)` is set once at module load so Postgres `NUMERIC` columns come
  back as JS numbers (not strings) everywhere in the app — don't re-parse prices manually.
- Money is stored as `NUMERIC`; booleans (`is_open`, `is_available`) are real Postgres `BOOLEAN`.
- Order creation (`POST /api/orders`) is the one multi-statement write path and runs inside an
  explicit `pool.connect()` / `BEGIN` / `COMMIT` transaction (insert order, then insert each
  order_item) — follow that pattern for any other multi-row write that must be atomic.

**Auth** (`server/auth.js`):
- Stall owners only (customers never authenticate). JWT signed with `JWT_SECRET`, 12h expiry,
  payload is `{ ownerId, stallId, username }`.
- `requireAuth` middleware attaches `req.owner` and is applied per-route (not globally) — every
  `/api/owner/*` route is scoped to `req.owner.stallId`, so a logged-in owner can only ever see
  or modify their own stall's data. When adding an owner-facing route, always filter queries by
  `req.owner.stallId`, not just by the resource's own id.

**Order status machine** (`server/app.js`, `VALID_TRANSITIONS`):
`placed → preparing → ready → handed_over`, with `placed`/`preparing` also able to go to
`cancelled`. Enforced server-side on `PATCH /api/owner/orders/:orderId/status` — invalid jumps
(e.g. `placed → handed_over`) are rejected with 400. Extend `VALID_TRANSITIONS` rather than
special-casing new transitions in the handler.

**Frontend structure** (`client/src/`):
- `lib/api.js` — single fetch wrapper (`api.*` methods); all HTTP calls go through this, base URL
  is always the relative `/api` (works via Vite's dev proxy locally and via Vercel's rewrite in
  prod — no environment-specific API URL config needed).
- `lib/CartContext.jsx` — cart is per-stall in memory (not persisted); switching stalls clears it.
- `lib/OwnerAuthContext.jsx` — owner JWT lives in `localStorage`; on mount, calls `api.me()` to
  validate the stored token before rendering owner routes.
- `components/RequireOwnerAuth.jsx` — route guard used to wrap `/owner/dashboard` and
  `/owner/menu` in `App.jsx`; redirects to `/owner/login` if there's no valid session.
- Customer order tracking and the owner dashboard both poll every 5s (no websockets/push).

## Notes on scope (intentional, not gaps to "fix" silently)

- Payments are tracked (`pending`/`paid`) but not processed — no real payment gateway.
- No password reset flow for stall owners, and no cross-stall admin view — each owner sees only
  their own stall.
