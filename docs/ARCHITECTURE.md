# FNB App — System Architecture

> Last updated: 2026-04-17
> This is the single source of truth for system structure. Update after each structural change.

---

## 1. Overview

A multi-brand, multi-outlet F&B management system serving 2 brands and 7 outlets. Covers POS, order management, and revenue reporting.

```
Browser (Vanilla JS / HTML / CSS)
        │
        │  HTTPS — Supabase REST API
        ▼
  Supabase (PostgreSQL + RLS)

  Hosted on GitHub Pages — auto-deploy on push to main
```

**Core principles:**
- No backend server — Supabase RLS enforces all access control
- No frontend framework — plain HTML/CSS/JS, one page per module
- POS works offline — writes queue locally (IndexedDB), sync on reconnect
- Security boundary is Supabase RLS + API key, not the frontend

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vanilla JS / HTML / CSS | No build tooling |
| Database | Supabase (PostgreSQL) | RLS for access control |
| Auth | Custom (users table) | SHA-256 password hash, session in localStorage |
| Hosting | GitHub Pages | Auto-deploy from `main` |
| Excel export | SheetJS (CDN) | Used in Revenue |
| HTTP client | `src/lib/supabase.js` | Fetch wrapper — API key stored here only |

---

## 3. Multi-Brand / Multi-Outlet Design

### 3.1 Hierarchy

```
brands
  └── outlets (each outlet belongs to one brand)
        ├── users.outlet_id     → staff is bound to one outlet
        └── orders.outlet_id    → every sale is tagged to outlet + brand
```

### 3.2 Assignment Rules

- **Staff account** always has `outlet_id` set. POS reads this on init — staff never selects their outlet manually.
- **Manager / Owner** have `outlet_id = null`. Manager sees only their brand; owner sees all.
- `brand_id` on orders is derived from `outlets.brand_id` — never entered manually.

### 3.3 Current Outlets

| Brand | Code | Outlets |
|---|---|---|
| Cà Phê Sáng | `CF_SANG` | CF_O1 → CF_O5 (5 outlets) |
| Trà Tối | `TRA_TOI` | TRA_O1 → TRA_O2 (2 outlets) |

---

## 4. Database Schema (10 tables)

> Full DDL: `migrations/019_reset_schema.sql`

### 4.1 Table Overview

| Table | Purpose |
|---|---|
| `brands` | Brand definitions (CF_SANG, TRA_TOI) |
| `outlets` | Physical outlets, each belonging to a brand |
| `users` | Staff accounts (username/password_hash/role/outlet_id) |
| `orders` | All sales transactions |
| `settings` | Key-value config (bank info, operating hours) |
| `raw_materials` | Ingredient definitions (g, ml) |
| `semi_products` | Brewed batch definitions (BTP) |
| `supplies` | Consumable supplies (cups, lids, straws) |
| `products` | Menu items sold at POS |
| `product_recipes` | Ingredient list per product (informational) |

### 4.2 Key Column Notes

**`orders`**
- `method` text — `'Tiền mặt'` | `'Chuyển khoản'` (not `pay_method`)
- `client_id` uuid — client-generated UUID, unique partial index `WHERE client_id IS NOT NULL`
- `items` jsonb — `[{id, name, qty, price}]`
- `voided` boolean — soft delete, default false

**`users`**
- `password_hash` text — SHA-256 hex, hashed client-side via Web Crypto API
- `outlet_id` null for manager/owner, set for staff

**`product_recipes`**
- `ingredient_type` — `'semi'` | `'raw'` | `'supply'`
- `ingredient_id` — text PK from the corresponding reference table

### 4.3 Row Level Security

All tables have RLS enabled with permissive `USING (true)` policies.
Access control is enforced client-side via `auth.js` + the Supabase anon key.

---

## 5. Frontend Architecture

### 5.1 Module Map

```
src/
├── lib/
│   ├── supabase.js         ← DB helpers (select/insert/update/upsert/delete) + hashPassword()
│   ├── utils.js            ← fmt(), fmtDate(), toast()
│   ├── idb-service.js      ← IndexedDB: offline order queue + menu cache
│   ├── revenue-service.js  ← fetchOrders(from, to, brandFilter)
│   └── settings-service.js ← fetchInitData, fetchUsers, saveUser, changePassword, saveSettings
├── auth/
│   ├── login.html + login.js   ← staff→POS, manager/owner→Home
│   └── auth.js                 ← Auth singleton, permissions, session
├── home/
│   ├── index.html + home.js    ← navigation hub, today's stats (manager/owner)
├── pos/
│   ├── index.html + pos.js     ← 3 tabs: Bán hàng / Hôm nay / Tổng kết
├── orders/
│   ├── index.html + orders.js  ← order history, void, search
│   ├── edit.html + edit.js     ← edit order (manager/owner)
├── revenue/
│   ├── index.html + revenue.js ← sales report + chart + Excel export
├── menu/
│   ├── index.html + menu.js    ← product CRUD + recipe editor
└── settings/
    ├── index.html + settings.js ← user management, payment settings
```

### 5.2 Session & Routing

```
Login → check username/password_hash in users table
      → store { id, name, role, permissions } in localStorage as fnb_session
      → role === 'staff'             → src/pos/index.html
      → role === 'manager' | 'owner' → src/home/index.html
```

`fnb_session` does **not** store `outlet_id` — POS fetches it fresh on each init.

### 5.3 POS Init Flow

```
init()
  1. Read session.id from localStorage
  2. Query users WHERE id = session.id        → outlet_id   (posOutletId)
  3. Query outlets WHERE id = outlet_id       → brand_id    (posBrandId)
  4. Load menu from DB (cache to IDB)
  5. Get latest order_num from DB

confirmPay()
  → build orderPayload { ..., method: 'Tiền mặt'|'Chuyển khoản', outlet_id, brand_id }
  → save to IDB queue first (always succeeds offline)
  → if online: flush queue to Supabase
```

### 5.4 Brand Filter Pattern

Manager can only see orders within their brand:

```js
// initBrandFilter() — in home.js, revenue.js
const userRows   = await DB.select('users',   `id=eq.${session.id}&select=outlet_id`);
const outletRows = await DB.select('outlets', `id=eq.${outletId}&select=brand_id`);
brandFilter = `&brand_id=eq.${brandId}`;  // appended to all queries
```

Owner and staff: no brand filter.

---

## 6. Offline-First (POS)

### 6.1 Strategy

```
Staff taps "Confirm Payment"
        │
        ▼
Write to IndexedDB queue  ← always succeeds, even offline
        │
        ├── Online?  → flush to Supabase → remove from queue
        │
        └── Offline? → stay in queue, show pending count badge
                       → auto-flush when `online` event fires
```

### 6.2 Idempotency

- Each order payload includes `client_id` (UUID, generated client-side)
- Partial unique index on `orders(client_id) WHERE client_id IS NOT NULL`
- HTTP 409 on sync = already exists → remove from IDB queue, do not retry

### 6.3 What Works Offline

| Feature | Offline? |
|---|---|
| POS — take order + payment | Yes (queued) |
| POS — read menu / prices | Yes (cached at init) |
| Orders / Revenue / Settings | No |

---

## 7. Authorization Matrix

| Feature | staff | manager | owner |
|---|:---:|:---:|:---:|
| POS — sell | ✓ | ✓ | ✓ |
| View today's orders (POS tab) | ✓ | ✓ | ✓ |
| Void orders (POS tab) | — | ✓ | ✓ |
| View order history | — | ✓ | ✓ |
| Edit orders | — | ✓ | ✓ |
| View revenue reports | — | ✓ | ✓ |
| Manage menu & recipes | — | — | ✓ |
| Manage user accounts | — | — | ✓ |
| Payment settings | — | — | ✓ |

---

## 8. Deployment

```
git push main
    └── GitHub Actions → GitHub Pages
                       → https://sanh0605.github.io/fnbapp
```

- Supabase migrations run manually via SQL Editor
- API key: `src/lib/supabase.js` only — never committed to docs

---

## 9. Key Technical Decisions

| Decision | Reason |
|---|---|
| Custom auth (not Supabase Auth) | Simpler setup; RLS uses `USING (true)` — no auth.uid() dependency |
| `outlet_id` not cached in session | Ensures correct assignment if staff is reassigned |
| `brand_id` derived from outlet | Single source of truth — no manual entry errors |
| IDB queue before Supabase write | Order never lost even if network drops mid-checkout |
| `client_id` partial unique index | Idempotent sync without complex server logic |
| 1 device per outlet | Eliminates offline write conflicts — no CRDT needed |
