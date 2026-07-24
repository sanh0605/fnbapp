# Handoff — WF-1: Per-Item Purchase History + PO Item Search + Supplier Links

> **READ FIRST**: `docs/COLLABORATION.md`. Source audit:
> `docs/audits/2026-07-24-workflow-forms-popups-search-audit.md` section D.
> Owner approved 2026-07-24 ("tất cả theo khuyến nghị của em").
> Implementer: Codex or Claude Sonnet 5 (routine tier — read-only queries, no
> schema change, no write path). Review: per the 2026-07-24 supervision model.

## Why

Two owner scenarios are impossible today (verified against code):
seeing the purchase history of one purchased item requires opening every PO;
the PO list search matches only `po.id` + supplier name, never item names.

## Scope — three small pieces, one commit each

### WF-1a. Per-item purchase history

- New read-only server action (e.g. `getItemPurchaseHistory(itemId)` in
  `app/admin/inventory/items/actions.ts`): query `purchase_order_lines` by the
  item reference, join minimal PO header fields (date, supplier, status),
  return rows sorted newest-first: date, qty + unit, unit cost, line total,
  supplier, PO id/link. Use a direct Supabase query with `.eq()` on the item
  column — check the real column name against `supabase/migrations/0001_init_schema.sql`
  (`purchase_order_lines.purchase_order_id` is the PO FK; find the item FK the
  same way — do NOT guess from old code, a stale `po_id` guess already caused
  SCRIPT-BUG-1).
- UI on `/admin/inventory/items`: a "Lịch sử nhập" button per row opening the
  history (modal is acceptable here — read-only viewer, small scope; the
  popup→page migration policy targets complex EDIT forms, not viewers).
  Show a simple price-trend hint (e.g. compare latest vs previous unit cost).
- ADMIN-guarded like the surrounding actions.

### WF-1b. PO list: item-name search + date range

- Extend the PO list data path so search also matches item names inside PO
  lines. Current page loads all POs client-side (`PurchaseOrdersClient`); the
  minimal correct version: server action resolves matching item ids by name
  (`ilike`), then POs whose lines contain those items (`in()` on the lines
  table, select `purchase_order_id`), merged with the existing id/supplier
  match. Keep the current client filter UX otherwise; add a from/to date
  filter matching the house pattern (`OrderTable`-style date inputs).
- 55 POs today — no pagination needed in this pass; note it for the future.

### WF-1c. Supplier → filtered PO list link

- `SuppliersClient`: per-row link to `/admin/inventory/purchase-orders?supplier=<id>`;
  `PurchaseOrdersClient` reads that param to preset its existing supplier
  filter (it already has the filter state — just seed it from the URL).

## Acceptance

- Owner can answer both scenarios in ≤2 clicks each.
- `tsc` 0 errors, full suite green (baseline 673), `next build` passes.
- Read-only verified: no new insert/update/delete path in the diff.
- Commit prefix per implementing agent. No push.

## WF-2 (separate, after WF-1 review): per-item stock movement history

Same viewer pattern on `/admin/reports/stock`: paginated `Stock_Ledger`
drill-down per item (date, type, quantity change, reference), newest-first,
server-side `.range()` pagination from day one (this table is 11,700+ rows).
Scope in its own right after WF-1 lands and is reviewed.
