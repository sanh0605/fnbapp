# MAC COGS And Quantity Ledger Design

Date: 2026-06-25
Repo: `fnbapp`
Status: implemented for write path, historical active order lines, and P&L breakdowns

## Decision

The app separates inventory control from COGS valuation:

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

Forecasting and reorder suggestions should use current quantity balance, recent consumption rate, minimum stock thresholds, supplier lead time, and planned production needs. They should not require FIFO batch state.

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
- Reports must not double count both semi-product and base ingredients for the same required quantity.

## Implementation

Implemented in the Phase 5A code pass:

- Shared MAC engine: `lib/mac-cogs.ts`.
- POS write path: `app/pos/actions.ts` stores `cost_at_sale` from MAC.
- Admin order edit write path: `app/admin/orders/actions.ts` stores edited line `cost_at_sale` from MAC.
- Read-only MAC drift audit: `scripts/audit-mac-cogs-drift.ts`.
- Guard tests: `lib/mac-cogs.test.ts`, `app/pos/actions.test.ts`, `app/admin/orders/actions.test.ts`.

Historical active order lines were migrated on 2026-06-26:

- Updated `1267` `Order_Lines_V2.cost_at_sale` cells.
- Post-apply MAC drift audit: mismatch `0`, delta `0`.

## P&L Breakdown MAC Refactor

The previous P0 outstanding item for P&L breakdown consistency is implemented and audited.

References:

- Commit `a63f0b1` — `Codex: reconcile PnL MAC breakdowns`
- Commit `4bf795c` — `Codex: canonicalize PnL topping modifiers`
- Audit script: `scripts/audit-pnl-mac-consistency.ts`

Status:

- P&L total COGS reads stored `Order_Lines_V2.cost_at_sale`.
- Product and topping breakdowns allocate stored MAC COGS instead of recomputing FIFO for normal reports.
- Ingredient breakdown uses MAC-weighted allocation and reconciles to stored line COGS.
- Topping modifier identity is canonicalized to the active modifier where historical data used an old duplicated modifier id.
- Latest audit result: `0` mismatches and `0` delta.

## Resolved Questions

### Historical orders rewrite vs cutover date

Decision: rewrite all historical active order lines.

Rationale: P&L report stays consistent; there is no mixed period where COGS changes meaning. Historical `cost_at_sale` was MAC-recalculated for `1267` lines with classifications `BTP_SHORTFALL`, `MIGRATED_LINE`, and `MAC_REPRICE`. Post-apply MAC drift audit is clean.

### `Stock_Ledger.unit_cost` on `SALES_CONSUME`

Decision: do not populate MAC into `Stock_Ledger.unit_cost` for `SALES_CONSUME` rows.

Rationale:

- Ledger is the quantity source of truth, not the cost source of truth.
- MAC is stored at `Order_Lines_V2.cost_at_sale` to avoid dual-source-of-truth.
- MAC drift audit recomputes from `PO_RECEIPT` history and does not require `SALES_CONSUME.unit_cost`.

### Semi-product MAC explicit at production or lazy at sale

Decision: lazy at sale/consume time from recipe ingredients.

Rationale:

- `lib/mac-cogs.ts` resolves semi-product recipe fallback recursively when direct MAC is missing.
- Production yield entries track quantity.
- This avoids duplicate MAC tracking between semi-product MAC and ingredient MAC.

Trade-off: if ingredient MAC changes between production and sale, COGS reflects MAC at sale time. This is acceptable for current F&B operations because production-to-sale is usually short.

## Verification Gates

Required gates after MAC-related changes:

- Unit tests for MAC averaging across multiple PO receipts.
- Unit tests for zero-stock fallback to latest known MAC.
- Unit tests for semi-product partial shortfall COGS.
- `scripts/audit-order-ledger.ts` clean for quantity changes when relevant.
- MAC COGS drift audit clean or reviewed with accepted historical differences.
- `scripts/audit-pnl-mac-consistency.ts` reports `0` mismatches.
- Current stock audit remains independent from costing method.
