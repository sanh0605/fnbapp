# System map (hand-drawn overview)

Concise map for humans. The full machine-derived map lives in
`docs/generated/system-map.md` (do not hand-edit that one).

Note: `lib/sheets_db.ts` is the DB adapter — the name says Google Sheets but the
implementation is Supabase (spec §3.2c).

Two casings of a name (e.g. `Products`/`products`) are the same table — one comes
from a `sheets_db` call, the other from an RPC body. See `SYSTEM-OVERVIEW.md`.

## Every write relation

The fenced `relations` block below is the machine-read source of truth for this
hand map (the map-drift gate compares it against `docs/generated/system-map.md`).
It lists every `file -> table (write)` relation the code performs. The prose that
follows groups the same relations by area for human reading only.

```relations
app/actions/auth.ts -> users (write)
app/admin/brands/actions.ts -> Brands (write)
app/admin/inventory/actions.ts -> Item_Categories (write)
app/admin/inventory/actions.ts -> Purchase_Order_Lines (write)
app/admin/inventory/actions.ts -> Purchased_Items (write)
app/admin/inventory/actions.ts -> Stock_Adjustments (write)
app/admin/inventory/actions.ts -> Units (write)
app/admin/inventory/actions.ts -> UOM_Conversions (write)
app/admin/inventory/asset-bands/actions.ts -> asset_depreciation_bands (write)
app/admin/inventory/assets/actions.ts -> asset_disposals (write)
app/admin/inventory/conversions/actions.ts -> Purchase_Order_Lines (write)
app/admin/inventory/conversions/actions.ts -> UOM_Conversions (write)
app/admin/inventory/items/actions.ts -> Purchase_Order_Lines (write)
app/admin/inventory/items/actions.ts -> Purchased_Items (write)
app/admin/inventory/items/actions.ts -> UOM_Conversions (write)
app/admin/inventory/purchase-orders/actions.ts -> assets (write)
app/admin/inventory/purchase-orders/actions.ts -> purchase_order_edits (write)
app/admin/inventory/purchase-orders/actions.ts -> Purchase_Sources (write)
app/admin/outlets/actions.ts -> Outlets (write)
app/admin/pos-sync/actions.ts -> Pos_Sync_Failures (write)
app/admin/products/actions.ts -> Product_Variants (write)
app/admin/products/actions.ts -> Products (write)
app/admin/products/categories/actions.ts -> Product_Categories (write)
app/admin/products/modifiers/actions.ts -> Modifiers (write)
app/admin/products/toppings/actions.ts -> Products (write)
app/admin/promotions/actions.ts -> Promotions (write)
app/admin/suppliers/actions.ts -> Suppliers (write)
app/admin/users/actions.ts -> Users (write)
app/pos/actions.ts -> POS_Drafts (write)
app/pos/actions.ts -> Pos_Sync_Failures (write)
lib/manual-issue-transaction.ts -> issue_slips (write)
lib/manual-issue-transaction.ts -> stock_issues (write)
lib/product-erase-transaction.ts -> product_price_history (write)
lib/product-erase-transaction.ts -> product_variants (write)
lib/product-erase-transaction.ts -> products (write)
lib/product-save-transaction.ts -> product_price_history (write)
lib/product-save-transaction.ts -> product_variants (write)
lib/product-save-transaction.ts -> products (write)
lib/product-save-transaction.ts -> recipes (write)
lib/purchase-order-transaction.ts -> purchase_order_lines (write)
lib/purchase-order-transaction.ts -> purchase_orders (write)
lib/stock-adjustment-transaction.ts -> stock_adjustments (write)
lib/stocktake-transaction.ts -> stock_issues (write)
lib/stocktake-transaction.ts -> stocktake_lines (write)
lib/stocktake-transaction.ts -> stocktake_sessions (write)
lib/void-order-transaction.ts -> order_events (write)
lib/void-order-transaction.ts -> orders_v2 (write)
```

## The same relations, grouped by area

**Sales.** `app/pos/actions.ts` writes `POS_Drafts` and `Pos_Sync_Failures` (the
POS device sync writes the completed sale itself). `lib/void-order-transaction.ts`
writes `orders_v2` and `order_events`. `app/admin/promotions/actions.ts` writes
`Promotions`.

**Purchasing.** `lib/purchase-order-transaction.ts` writes `purchase_orders` and
`purchase_order_lines`. `app/admin/inventory/purchase-orders/actions.ts`
writes `assets`, `purchase_order_edits`, and `Purchase_Sources`.
`app/admin/suppliers/actions.ts` writes `Suppliers`.

**Stock issue and adjustment.** `lib/manual-issue-transaction.ts` writes
`issue_slips` and `stock_issues`. `lib/stock-adjustment-transaction.ts` writes
`stock_adjustments`. `app/admin/inventory/actions.ts` also
writes `Stock_Adjustments` (this file spans inventory-catalog and stock-issue).

**Stocktake.** `lib/stocktake-transaction.ts` writes `stocktake_sessions`,
`stocktake_lines`, and `stock_issues` (a closed count books its shortfall as an
issue).

**Products.** `app/admin/products/actions.ts` writes `Products` and
`Product_Variants`. `lib/product-save-transaction.ts` writes `products`,
`product_variants`, `product_price_history`, and `recipes`.
`lib/product-erase-transaction.ts` writes `products`, `product_variants`, and
`product_price_history`. `app/admin/products/categories/actions.ts` writes
`Product_Categories`; `app/admin/products/modifiers/actions.ts` writes
`Modifiers`; `app/admin/products/toppings/actions.ts` writes `Products`.

**Inventory catalog.** `app/admin/inventory/actions.ts` writes `Purchased_Items`,
`Item_Categories`, `Units`, `UOM_Conversions`, and `Purchase_Order_Lines`.
`app/admin/inventory/items/actions.ts` writes `Purchased_Items`,
`UOM_Conversions`, and `Purchase_Order_Lines`.
`app/admin/inventory/conversions/actions.ts` writes `UOM_Conversions` and
`Purchase_Order_Lines`.

**Assets.** `app/admin/inventory/assets/actions.ts` writes `asset_disposals`;
`app/admin/inventory/asset-bands/actions.ts` writes `asset_depreciation_bands`.
(`assets` rows are created via purchasing.)

**Users.** `app/actions/auth.ts` writes `users`; `app/admin/users/actions.ts`
writes `Users`.

**Operations.** `app/admin/pos-sync/actions.ts` writes `Pos_Sync_Failures`;
`app/admin/outlets/actions.ts` writes `Outlets`;
`app/admin/brands/actions.ts` writes `Brands`.

## Runtime components

Folded here from the former ARCHITECTURE.md. Conceptual "what the shop is"
lives in `SYSTEM-OVERVIEW.md`; this section is the runtime shape.

- **Browser.** Next.js 14 and React 18 render the POS, login, settings, and
  admin surfaces. Client Components handle interaction and receive data from
  Server Components or Server Actions. The browser is untrusted: service-role
  keys and backup tokens must never cross it.
- **Next.js server.** Runs through `next dev` locally and on Vercel in
  production (region `sin1`, the same region as the database). Hosts Server
  Components, Server Actions, and the NextAuth route. `lib/supabase.ts` makes a
  server-only Supabase client with the service key. The `Asia/Ho_Chi_Minh`
  timezone is set in `next.config.js` and the root layout.
- **Supabase.** Postgres is the operational database; migrations under
  `supabase/migrations/` define schema and RPCs. Critical multi-row writes go
  through RPC transactions. Edge Functions provide integration surfaces (backup
  snapshots, notifications, user administration). There is no Supabase Auth or
  Supabase Storage consumer — authentication is NextAuth Credentials.
- **External services.** Vercel hosts the app; Google Apps Script runs the
  scheduled backup trigger (~02:30 Asia/Ho_Chi_Minh daily); Google Drive stores
  the snapshots; Google Sheets holds legacy migration paths only.

## Request and data flows

- **Auth.** NextAuth Credentials takes username/password, compares the bcrypt
  hash on the matching Supabase user row, and issues a signed session carrying
  identity and technical role. `middleware.ts` protects `/admin/**` and
  `/pos/**`; STAFF users are redirected away from admin.
- **Read.** A Server Component or Server Action calls Supabase with server
  credentials, shapes the data for the UI, and must strip sensitive fields
  before serializing to a Client Component.
- **Write.** UI input reaches a Server Action, which validates and resolves the
  actor; simple writes use data helpers, critical multi-row writes use reviewed
  RPC/transaction paths.

## Major modules

| Module | Primary surfaces | Main responsibility |
|---|---|---|
| Authentication | `app/login`, `app/api/auth`, `lib/auth.ts` | Credentials login, sessions, technical-role propagation |
| POS | `app/pos` | Cart, pricing, checkout, drafts, order submission |
| Orders | `app/admin/orders` | Order review, edit, void, snapshots, event history |
| Catalog | `app/admin/products`, `app/admin/brands`, `app/admin/promotions` | Products, variants, modifiers, recipes, pricing, promotions |
| Purchasing and inventory | `app/admin/inventory` | Purchase orders, stock adjustments, current stock |
| Reports | `app/admin/reports` | Revenue, COGS, profit, consistency checks |
| Users | `app/admin/users` | User lifecycle and role data |
| Backup | Edge Function, Apps Script, Drive | Full snapshots, validation, retention, restore inputs |

## Boundaries and non-claims

- The server client uses a privileged key that can bypass RLS, so
  application-side authorization and response shaping are critical boundaries
  even where RLS policies exist. Route protection is observed; action-level
  authorization and RLS enforcement are not certified here (security review owns
  that). Intended roles are covered by `BR-ACCESS-001`.
- No script or admin workflow may rewrite production history merely because it
  can connect to the database. Historical correction requires a separate
  approved dry-run/apply/rollback plan.
- Non-claims: offline POS capability is UNVERIFIED; multi-brand/outlet/franchise
  is future scope, not the current operating model; Supabase Auth and Supabase
  Storage are not active components.
