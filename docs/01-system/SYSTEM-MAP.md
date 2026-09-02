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
lib/purchase-order-transaction.ts -> stock_ledger (write)
lib/stock-adjustment-transaction.ts -> stock_adjustments (write)
lib/stock-adjustment-transaction.ts -> stock_ledger (write)
lib/stocktake-transaction.ts -> stock_issues (write)
lib/stocktake-transaction.ts -> stock_ledger (write)
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

**Purchasing.** `lib/purchase-order-transaction.ts` writes `purchase_orders`,
`purchase_order_lines`, and `stock_ledger`. `app/admin/inventory/purchase-orders/actions.ts`
writes `assets`, `purchase_order_edits`, and `Purchase_Sources`.
`app/admin/suppliers/actions.ts` writes `Suppliers`.

**Stock issue and adjustment.** `lib/manual-issue-transaction.ts` writes
`issue_slips` and `stock_issues`. `lib/stock-adjustment-transaction.ts` writes
`stock_adjustments` and `stock_ledger`. `app/admin/inventory/actions.ts` also
writes `Stock_Adjustments` (this file spans inventory-catalog and stock-issue).

**Stocktake.** `lib/stocktake-transaction.ts` writes `stocktake_sessions`,
`stocktake_lines`, `stock_issues` (a closed count books its shortfall as an
issue), and `stock_ledger`.

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

Known stale tooling: `stock_ledger` was dropped, but three RPCs
(`lib/purchase-order-transaction.ts`, `lib/stock-adjustment-transaction.ts`,
`lib/stocktake-transaction.ts`) still name it as a write target. Left as-is in
the map because the generated map (the authority) still records those writes.
