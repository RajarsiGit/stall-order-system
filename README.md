# FoodCourt Hub

A multi-stall food ordering app: customers browse stalls, order, and track a
live ticket; stall owners watch an order queue, update status, and mark
payments received.

<img width="1920" height="828" alt="image" src="https://github.com/user-attachments/assets/d9ce8a70-d820-4842-ad66-0e3850f90a99" />

## Stack

- **Backend**: Node.js + Express, Postgres (Neon) via `pg`, JWT auth for stall owners
- **Frontend**: React + Vite + Tailwind CSS v4, React Router
- Deployed on Vercel: the frontend is a static build, the backend runs as a single
  serverless function (`api/index.js`) behind an `/api/*` rewrite.

## Project layout

```
api/      Vercel serverless entry point — re-exports the Express app
server/   Express app (server/app.js) + Postgres data layer (server/db.js)
client/   React frontend (customer + stall-owner interfaces)
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

**1. Start the backend**
```bash
cd server
npm run dev        # or: npm start
```
Runs on `http://localhost:4000`. On first request it creates the schema and
seeds 3 demo stalls with menus and owner logins (if the `stalls` table is empty).

**2. Start the frontend**
```bash
cd client
npm run dev
```
Runs on `http://localhost:5173` (Vite proxies `/api/*` to port 4000 — see
`client/vite.config.js`).

Open `http://localhost:5173` in your browser.

## Deploying to Vercel

```bash
vercel link                    # first time only
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add JWT_SECRET production
vercel env add JWT_SECRET preview
vercel deploy                  # preview
vercel deploy --prod           # production
```

`vercel.json` builds the client with `npm run build -w client` and serves the
API from `api/index.js` (the same Express app used locally), with `/api/*`
requests rewritten to that one function.

## Demo logins

Seeded by `server/db.js` — change these before any real deployment.

**Stall owners** (each scoped to their own stall only):

| Stall           | Username         | Password    |
|-----------------|------------------|-------------|
| Curry House     | `curryhouse`     | `password123` |
| Dosa Corner     | `dosacorner`     | `password123` |
| Burger Junction | `burgerjunction` | `password123` |

**Admin** (can create new stalls): `admin` / `admin123`

## How it works

**Customer flow**
1. Browse open stalls → pick a stall → browse its menu
2. Add items to cart (cart is per-stall; switching stalls clears it)
3. Checkout: enter name + optional phone/notes, no account needed
4. Get an order number (e.g. `CU-0191`) and land on a tracking page
5. Tracking page polls every 5s and shows status: placed → preparing → ready → handed over, plus payment status

**Stall owner flow**
1. Log in (scoped to their stall only)
2. Dashboard shows three live columns: New orders / Preparing / Ready — polls every 5s
3. Advance each order through its status with one click; cancel new orders if needed
4. Mark payment received per order (tracked, not processed — no real payment gateway)
5. Manage menu items (add/remove, toggle availability) and toggle the stall open/closed

**Admin flow**
1. Log in at `/admin/login` (separate login, not tied to any stall)
2. See every stall in the food court and add a new one — name, description, and an initial
   owner username/password for it, created in one step
3. Admins can't see or manage any stall's orders/menu — that stays with the stall owner login

## Data model

- `stalls` — name, description, open/closed
- `stall_owners` — login credentials, scoped to one stall
- `admins` — login credentials for the separate admin role (stall creation only)
- `menu_items` — per stall, with availability toggle
- `orders` — order number, customer info, status, payment status, total
- `order_items` — line items per order (price captured at order time, so later menu price changes don't retroactively change past orders)

Order status transitions are enforced server-side
(`placed → preparing → ready → handed_over`, or `placed/preparing → cancelled`)
so the API rejects invalid jumps (e.g. `placed → handed_over`).

## Notes on "real" vs. demo scope

- **Payments**: tracked as `pending`/`paid` only — there's no payment gateway integration. The stall owner marks orders paid manually, matching what you asked for.
- **Notifications**: the dashboard is a polling queue (refreshes every 5s), not push notifications. If you want actual push (browser notifications, sound alerts, SMS, etc.) that's a natural next step — say the word and I'll add it.
- **Auth**: JWT-based, 12-hour expiry, passwords hashed with bcrypt. Fine for a real small-scale deployment; if you're going to production with real money/customers, put this behind HTTPS and rotate `JWT_SECRET` in `server/.env`.
- **Database**: Postgres (Neon), via a thin `db.js` layer — needed because Vercel's serverless functions have no persistent local disk, so the original SQLite file approach couldn't survive a deploy there.

## Next steps you might want

- Owner ability to reset/change their password
- Admin visibility into orders/sales across all stalls (today admin can only create stalls, not view their activity)
- Order history / basic sales reporting per stall
- Sound or browser push notification when a new order lands
- QR code per stall linking straight to its menu
