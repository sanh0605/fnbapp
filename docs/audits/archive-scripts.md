# Archived One-Off Data-Fix Scripts

Listing-only reference for `ARCHIVE_DOC_ONLY`-classified scripts removed
from `scripts/` on 2026-07-20 as part of the post-audit repository
reorganization (`docs/superpowers/plans/2026-07-20-post-audit-repository-reorganization.md`).
None of these are meant to be re-run — each already applied its fix to
production data at the time it ran. Full source remains in git history
(`git log --all --full-history -- scripts/<name>`) if ever needed.

Cross-referenced against every other script/lib/doc before removal: none
had a real code dependency (only `batch-sheets-orders.ts`, which 3 of these
imported, is kept — it also has an unrelated dependent in `remigrate-per-audit.ts`,
a `KEEP_MIGRATION_HISTORY` script, so it stays regardless of this batch).

| Script | What it did |
|---|---|
| `add-line-manual-discount-column.ts` | Appended a `line_manual_discount` column to the legacy `Order_Lines` Google Sheet header row (Phase B). |
| `add-snapshot-column.ts` | Appended an `applied_promotion_snapshot_json` column to the legacy `Orders` Google Sheet header row (Phase 5 schema repair). |
| `add-transaction-date.ts` | Legacy Google Sheets header/column edit via the Sheets API directly (pre-Supabase). |
| `add-unit-actions.js` | Ad hoc fix to the legacy `Units` Google Sheet. |
| `apply-cogs-recalc.ts` | One-time COGS recalculation against `Stock_Ledger`/`Recipes`, with a dry-run vs. `--apply` mode. |
| `apply-mac-cogs-recalc.ts` | One-time MAC-based COGS recalculation against `Stock_Ledger`/`Recipes`, same dry-run/`--apply` pattern. |
| `apply-modifier-recipe-normalization.ts` | Normalized modifier recipes (`BASE_INGREDIENT`/`MODIFIER` types) in `Recipes`. |
| `apply-negative-stock-adjustments.ts` | Applied stock adjustments for negative-balance ingredients/semi-products via `Stock_Ledger`. |
| `apply-order-ledger-net-corrections.ts` | Corrected `Stock_Ledger` entries via an `ORDER_LEDGER_AUDIT_CORRECTION` transaction type (SALES_CONSUME/EDIT_REVERSAL reconciliation). |
| `apply-order-modifier-qty-cleanup.ts` | One-time cleanup of order-modifier quantity/`SALES_CONSUME` data, dry-run vs. `--apply`. |
| `apply-purchase-cost-recovery.ts` | Recovered/corrected purchase costs across `Purchase_Orders`/`Purchase_Order_Lines`/`Purchased_Items`/`UOM_Conversions`. |
| `apply-purchase-ledger-cleanup.ts` | One-time `Purchase_Orders`/`Purchase_Order_Lines` ledger cleanup, dry-run vs. `--apply`. |
| `audit-dao-mieng-report-cogs.ts` | Investigated a COGS report discrepancy for a specific product ("Dao Mieng"); bug since fixed, kept as reference. |
| `backfill-backdated-ledger-events.ts` | Backfilled `PO_RECEIPT`/`STOCK_ADJUST`/`PRODUCTION_YIELD` ledger events later identified as backdated (Task 3.x lineage). |
| `backfill-e1-edit-bug.ts` | Fixed orders affected by the E.1 `calculateTotal` bug (`total_amount` over-counted by summed `line_discount`) — recalculated `total_amount = subtotal - orderDiscount - sum(line_discount)`. |
| `backfill-inferred-high-promo-id.ts` | Backfilled an inferred `INFERRED_HIGH` promotion ID onto legacy completed `Orders`. |
| `backfill-orders-subtotal.ts` | Backfilled missing `subtotal` values on legacy completed `Orders`/`Order_Lines`. |
| `cleanup-backup-sheet.ts` | One-time cleanup of a legacy backup sheet's row schema, dry-run vs. `--apply`. |
| `cleanup-june-2026-orphans.ts` | Removed orphaned June 2026 orders with no matching lines, dry-run vs. `--apply`. |
| `clear-combo-order-discount.ts` | Cleared a `MANUAL_DISCOUNT` field on specific legacy `Orders`/`Order_Lines` combo-order rows. |
| `delete-po001.ts` | Deleted a specific test purchase order (`PO-001`) and its related `Stock_Ledger` rows. |
| `delete-prod37.ts` | Deleted a specific test product (`PROD-037`) and its variants. |
| `delete-remaining-review-sheets.ts` | Deleted remaining legacy review/staging sheets (`TONG`, `CCDC`, etc.) after their content was reconciled. |
| `revert-e1-backfill-overreach.ts` | Reverted part of `backfill-e1-edit-bug.ts`'s correction that had gone further than intended on some `Orders`. |
| `spotcheck-mod004.ts` | Spot-checked a specific modifier's (`MOD-004`) COGS via `Stock_Ledger`/`Recipes`/`Semi_Products`; bug since fixed, kept as reference. |
| `update-btp-dates.ts` | Updated dates on semi-product (`BTP`) recipes. |
| `update-inventory-v2.js` | Legacy Google Sheets inventory update via the Sheets API directly (pre-Supabase). |
| `update-po-headers.js` | Legacy Google Sheets purchase-order header update via the Sheets API directly (pre-Supabase). |
| `verify-cogs-allocation-impact.ts` | Verified the impact of a COGS allocation fix against `Stock_Ledger`/`Recipes`/`Semi_Products`; bug since fixed, kept as reference. |
| `zero-out-prorated-line-discounts.ts` | Zeroed out `Order_Lines.line_discount` on legacy completed `Orders` where the line-level discount total double-counted an already-applied order-level discount. |

## Not archived (kept in `scripts/` despite matching the `ARCHIVE_DOC_ONLY` naming pattern)

- `generate-script-cleanup-plan.ts`, `generate-script-cleanup-plan-core.ts`,
  `generate-script-cleanup-plan-core.test.ts` — the classifier's own keyword
  match (`cleanup-` appearing inside "script-**cleanup**-plan") is a false
  positive. This is the active, reusable tool that generates
  `docs/audits/script-cleanup-plan.md` itself — not a one-off data fix.
