# Purchasing flow (purchase orders and suppliers)

```flow-decl
routes: /admin/inventory/purchase-orders, /admin/inventory/purchase-orders/new, /admin/inventory/purchase-orders/[id], /admin/suppliers
files: lib/purchase-order-transaction.ts, app/admin/inventory/purchase-orders/actions.ts, app/admin/suppliers/actions.ts
tables: purchase_orders, purchase_order_lines, purchase_order_edits, Purchase_Sources, assets, Suppliers
brCodes: BR-INV-002
```

**Reviewed, no behaviour change — 2026-09-04:** Phase 6 dead-reference cleanup touched a declared source file's comments only (dead docs/... citations repointed or stripped); no logic changed.

This flow covers buying goods into the shared warehouse: recording a **purchase
order** (what was bought, from whom, at what price) and maintaining the
**suppliers** the shop buys from. A purchase order is entered from
`/admin/inventory/purchase-orders/new`, listed at
`/admin/inventory/purchase-orders`, and reopened for edit at
`/admin/inventory/purchase-orders/[id]`. Suppliers are managed at
`/admin/suppliers`.

The header and all its lines are saved together through one atomic database
function (`save_purchase_order_atomic`), called from
`lib/purchase-order-transaction.ts`. Purchase orders are exactly the kind of
critical multi-row write that must never partially succeed (`BR-INV-002`): either
the order and every line land, or nothing does.

**Receiving a purchase raises stock.** A completed purchase order is the shop's
"goods in" event — the quantities on its lines become on-hand stock, and their
prices are what the weighted-average cost is computed from. Costing replays the
full purchase history for each item (`lib/issue-costing.ts`): every completed
purchase adds its quantity and its money, so the average unit cost used when
goods later leave stock is driven by these purchase prices.

**Durable tools bought on a purchase order create `assets` rows.** When a new
order is completed, its equipment lines are turned into asset records: the action
plans the assets (`lib/asset-purchase-allocation.ts`) and inserts one `assets`
row per durable tool. This happens only when a **new** order is completed, not
when an existing order is edited — see question 5.

## Five-question current-state description

1. **States, and how each is set.** A purchase order has two states, set by the
   `status` field on save: `DRAFT` and `COMPLETED`. A draft is a work-in-progress
   order that has not yet brought goods in. Completing an order (`status` =
   `COMPLETED`) is what makes it a real receipt: it requires a supplier, a
   purchase source, and at least one line, and it is the moment stock is raised
   and assets are created. There is no separate "received" state beyond
   `COMPLETED`; a purchase order carries no per-line edit history of its own
   (unlike sales orders' `order_events`) — instead each edit is recorded as a row
   in `purchase_order_edits`.
2. **Buttons per screen, and when to hide them.** The purchase-order list at
   `/admin/inventory/purchase-orders` offers a button to create a new order
   (leading to `/admin/inventory/purchase-orders/new`) and a way to open an
   existing order at `/admin/inventory/purchase-orders/[id]`. The order form can
   save as draft or save as completed; the "save as completed" path should not be
   offered until a supplier, a source, and at least one line are present, since
   the action rejects a completed order missing any of them. The suppliers screen
   at `/admin/suppliers` offers add, edit, and deactivate for a supplier.
3. **What each list contains, and what is excluded.** The purchase-order list
   shows purchase orders (both drafts and completed orders). The suppliers list
   shows suppliers; deactivated suppliers are marked inactive rather than removed,
   so a supplier that historical orders still reference is never dropped from the
   data. Purchase **sources** (`Purchase_Sources`) are a small lookup of buying
   channels used to tag an order; they are maintained inline from the order form,
   not as a separate top-level screen.
4. **Valid inputs, and what happens outside the range.** Each order line needs a
   purchased item and a positive quantity and price; a completed order with no
   lines, no supplier, or no source is refused. Supplier fields are length-bound
   (name up to 120 characters, phone up to 32, tax code up to 64, address up to
   500, notes/links up to 2.000); a value over its limit is rejected with a
   message, and a new supplier whose active name duplicates an existing one is
   blocked. Because the whole order is one atomic write, a persisted line-count
   that does not match the submitted lines is treated as a failure and the save
   is reported as an error rather than silently accepted.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   purchases into the shared warehouse and the supplier and source records those
   purchases reference. It deliberately does **not** re-derive assets on an
   **edit**: assets are created only for a newly completed order, so editing an
   existing completed order does not create, overwrite, or remove the asset rows
   that its original completion produced. It also does not manage what happens to
   an already-created asset when its source order is later edited — that is out of
   scope here and handled (if at all) by the assets flow, not this one.

## Where it writes

The atomic function writes the order header (`purchase_orders`) and one row per
line (`purchase_order_lines`). The purchase-orders action additionally writes
`assets` (one row per durable tool on a newly completed order),
`purchase_order_edits` (the edit trail, since purchase orders keep no
`order_events`), and `Purchase_Sources` (the buying-channel lookup). The
suppliers action writes `Suppliers`. The generated map at
`docs/generated/system-map.md` confirms exactly these write relations for the
three declared files.

`lib/purchase-order-transaction.ts` runs the RPC `save_purchase_order_atomic`.
Migration 0078 (Phase C) removed that function's `stock_ledger` write before
Phase D dropped the table itself (migration 0096); the current function body
does not reference `stock_ledger`. `BR-INV-001` (the old "quantity movement
belongs in the stock ledger" rule) was retired in favour of the issue-based
cost path (`BR-COGS-005`).

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
