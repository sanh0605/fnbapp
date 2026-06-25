# MAC COGS And Quantity Ledger Design

Date: 2026-06-25
Repo: `fnbapp`
Status: implemented for write path and historical active order lines

## Decision

The app will separate inventory control from COGS valuation:

- Inventory control uses `Stock_Ledger.quantity_change` as the source of truth.
- P&L COGS uses MAC, meaning weighted average cost, pinned at order creation/edit time and stored in `Order_Lines_V2.cost_at_sale`.
- FIFO remains an optional audit/debug method, not the primary report contract.

## Why

FIFO is precise when the business needs lot-level costing, expiry control, or strict batch accounting. This app does not currently track lot IDs or expiry per sale, so FIFO creates high operational complexity without enough business value.

MAC is more stable for F&B operations:

- PO price changes update average cost gradually.
- Order COGS is less likely to drift due to batch reconstruction.
- Historical P&L remains stable because each order line stores `cost_at_sale`.
- Current stock and reorder forecast still work because they depend on quantities, not costing method.

## Inventory Contract

Inventory quantity remains ledger-based:

- `PO_RECEIPT` increases stock.
- `SALES_CONSUME` decreases stock.
- `EDIT_REVERSAL` reverses edited or voided order consumption.
- `PRODUCTION_CONSUME` decreases recipe ingredients.
- `PRODUCTION_YIELD` increases semi-product stock.
- `STOCK_ADJUST` records manual corrections.

Forecasting and reorder suggestions should use:

- current quantity balance,
- recent consumption rate,
- minimum stock thresholds,
- supplier lead time,
- planned production needs.

They should not require FIFO batch state.

## COGS Contract

The canonical report path is:

1. Purchase order receipt updates stock quantity and contributes to MAC for the received item.
2. POS/admin edit calculates ingredient consumption quantity.
3. For each consumed item, use MAC at sale time.
4. Store final line total in `Order_Lines_V2.cost_at_sale`.
5. P&L reads stored `cost_at_sale`; it does not recompute FIFO for normal reports.

If stock is zero or negative, MAC should still return the latest known average cost for that item. The stock audit flags the quantity issue separately.

## Semi-Product Policy

Semi-products keep the existing quantity policy:

- If semi-product stock is available, consume available semi-product quantity.
- If semi-product stock is partially available, consume the available amount and explode only the shortfall into base ingredients.
- If semi-product stock is zero, explode the full required quantity into base ingredients.

For MAC COGS:

- Direct semi-product consumption uses the semi-product MAC if available.
- Shortfall exploded to base ingredients uses each base ingredient MAC.
- Reports should not double count both semi-product and base ingredients for the same required quantity.

## Data Migration Plan

Implementation should include a dry-run first:

1. Build a read-only MAC recomputation audit for all active order lines.
2. Compare stored `cost_at_sale` against expected MAC COGS.
3. Classify differences by order date, ingredient, and whether semi-product shortfall was involved.
4. Add an apply script only after audit output is reviewed.
5. Update affected historical `Order_Lines_V2.cost_at_sale` if the new MAC contract is accepted for historical reports.

The apply script must be idempotent and should write an audit report before changing data.

## Implementation Notes

Implemented in the first Phase 5A code pass:

- Shared MAC engine: `lib/mac-cogs.ts`.
- POS write path: `app/pos/actions.ts` stores `cost_at_sale` from MAC.
- Admin order edit write path: `app/admin/orders/actions.ts` stores edited line `cost_at_sale` from MAC.
- Read-only drift audit: `scripts/audit-mac-cogs-drift.ts`.
- Guard tests: `lib/mac-cogs.test.ts`, `app/pos/actions.test.ts`, `app/admin/orders/actions.test.ts`.

Historical active order lines were migrated on 2026-06-26:

- Updated `1267` `Order_Lines_V2.cost_at_sale` cells.
- Post-apply MAC drift audit: mismatch `0`, delta `0`.

## Code Changes Needed

- Add a shared MAC costing module, likely `lib/mac-cogs.ts`.
- Replace FIFO COGS calculation in `app/pos/actions.ts`.
- Replace FIFO COGS calculation in `app/admin/orders/actions.ts`.
- Convert `scripts/audit-cogs-drift.ts` from FIFO drift to MAC drift, or add a new `scripts/audit-mac-cogs-drift.ts` and keep FIFO audit as optional.
- Update report wording and docs to say P&L uses stored MAC COGS.
- Keep stock audits focused on quantity mismatches and negative stock.

## Verification

Required gates after implementation:

- Unit tests for MAC averaging across multiple PO receipts.
- Unit tests for zero-stock fallback to latest known MAC.
- Unit tests for semi-product partial shortfall COGS.
- `scripts/audit-order-ledger.ts` clean for quantity.
- MAC COGS drift audit clean or reviewed with accepted historical differences.
- P&L total COGS equals sum of active `Order_Lines_V2.cost_at_sale`.
- Current stock audit remains independent from costing method.

## Open Questions

- Should historical orders be rewritten to MAC, or should MAC apply only from the cutover date?
- Should `Stock_Ledger.unit_cost` on `SALES_CONSUME` be populated with MAC for easier audit, or should only order lines store COGS?
- Should semi-products have explicit production MAC based on recipe ingredients at production time, or derive MAC lazily from consumed recipe ingredients at sale time?
