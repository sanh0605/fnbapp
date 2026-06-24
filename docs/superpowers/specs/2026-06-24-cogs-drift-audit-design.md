# COGS Drift Audit Design

Date: 2026-06-24

## Goal

Find completed orders whose stored `Order_Lines_V2.cost_at_sale` differs from the FIFO cost that should be derived from `Stock_Ledger`, then identify the safest correction path.

The first pass is read-only. It must not update Google Sheets or rewrite stock ledger rows.

## Context

The app currently has two COGS calculation paths:

- POS order creation uses FIFO through `computeLineCostFIFO` and `FIFOTracker`.
- Admin order editing uses the older MAC calculation through `computeLineCostAtSale`.
- `/api/recalculate-cogs` can recalculate `Order_Lines_V2.cost_at_sale` with FIFO, but it directly updates historical line costs and should not be the first step.

This makes edited orders a likely source of COGS drift, but the audit should verify the data before any fix is applied.

## Data Scope

Read these tables:

- `Orders_V2`
- `Order_Lines_V2`
- `Stock_Ledger`
- `Recipes`
- `Semi_Products`

Include only orders where:

- `status` is `COMPLETED`
- `superseded_by` is empty
- `created_at` is present

Exclude voided, superseded, draft, or malformed orders from the main mismatch list. Malformed rows should be reported separately.

## Audit Logic

1. Load all required tables with no cache.
2. Build a semi-product context from `Recipes` and `Semi_Products`.
3. Map each order line to its order.
4. Sort eligible lines by the parent order `created_at` so FIFO consumption is deterministic.
5. Initialize a `FIFOTracker` from `Stock_Ledger`.
6. For each eligible line:
   - Parse `recipe_snapshot_json`.
   - Compute `expected_cost` with `computeLineCostFIFO`.
   - Compare it with stored `cost_at_sale`.
   - Mark a mismatch when absolute delta is greater than 1 VND.
7. Group mismatches by order and report the largest deltas first.

The report should include:

- Total eligible orders and lines checked.
- Number of mismatched lines and orders.
- Total stored COGS, total expected FIFO COGS, and total delta.
- Top mismatched orders: `order_no`, `order_id`, created time, stored COGS, expected COGS, delta, line count.
- Top mismatched lines: line id, order number, product id, variant id, quantity, stored COGS, expected COGS, delta.
- Warnings for missing order, invalid recipe snapshot, missing semi-product recipe, missing yield, or FIFO shortfall if detectable.

## Likely Root Causes To Check

- Edited orders may have been recalculated with MAC because `editOrderV2` calls `computeLineCostAtSale`.
- Historical orders before the FIFO migration may still hold MAC or zero COGS.
- Purchase order ledger entries may have changed after orders were created, making old stored COGS stale.
- Recipe snapshots may reference semi-products or ingredients that no longer resolve cleanly.

## Correction Strategy

Use a two-step correction path:

1. Generate the read-only audit report and review the affected orders.
2. After confirmation, apply one of these fixes:
   - Targeted data fix for mismatched rows only.
   - Full FIFO recalc through the existing recalc path after validating the mismatch report.
   - Code fix to make `editOrderV2` use FIFO so future edited orders do not drift.

The recommended durable code fix is to align admin edit COGS with POS COGS by replacing MAC calculation in `editOrderV2` with the same FIFO approach used by `submitOrderV2`, including semi-product context.

## Safety Rules

- The audit script must be read-only by default.
- Any write mode must require an explicit flag and should print a dry-run summary first.
- Do not rewrite `Stock_Ledger` as part of this audit.
- Do not call `/api/recalculate-cogs` until the mismatch report has been reviewed.
- Preserve existing uncommitted user changes.

## Testing

Add focused tests only when implementing code changes:

- FIFO audit detects a stored cost mismatch.
- Admin order edit uses FIFO, not MAC.
- Existing POS FIFO behavior remains unchanged.
- Malformed recipe snapshots are reported without aborting the whole audit.

## Open Decisions

The approved first step is the read-only audit plus root-cause classification. Data writes and code changes require a separate approval after reviewing the report.
