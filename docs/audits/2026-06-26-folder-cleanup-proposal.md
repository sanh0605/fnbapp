# Folder Cleanup Proposal

Date: 2026-06-26
Owner: Codex
Status: proposal only, no files deleted in this session

## Scope

This proposal lists cleanup candidates in the repo before the next multi-agent optimization workflow. It is intentionally read-only: do not delete or archive anything from this document without a separate approved cleanup phase.

## Cleanup Rules

- Keep scripts that are part of repeatable verification gates.
- Keep scripts that have `--apply` data-write capability until they are archived with their audit output and final run date.
- Archive one-off investigation scripts only after confirming no current roadmap item imports or documents them as an active gate.
- Prefer `docs/audits/archive/` or `scripts/archive/` before deletion for anything that touched Google Sheets data.
- Any destructive cleanup must be its own commit.

## Keep As First-Class Audit Gates

These are still part of normal verification or current inventory/COGS work:

- `scripts/audit-cogs-drift.ts`
- `scripts/audit-mac-cogs-drift.ts`
- `scripts/audit-pnl-mac-consistency.ts`
- `scripts/audit-current-stock.ts`
- `scripts/audit-order-ledger.ts`
- `scripts/audit-purchase-ledger.ts`
- `scripts/audit-po-save-ledger.ts`
- `scripts/audit-water-sugar-transition.ts`
- `scripts/audit-negative-stock-periods.ts`
- `scripts/audit-negative-periods-classification.ts`
- `scripts/audit-negative-btp-orders.ts`
- `scripts/audit-free-discount-orders.ts`
- `scripts/audit-order-total-consistency.ts`
- `scripts/audit-order-modifier-qty.ts`
- `scripts/verify-v2-schema.ts`
- `scripts/verify-v2-invariants.ts`

## Scripts To Archive After Review

These look like one-off migration, investigation, or historical repair scripts. They should be moved to `scripts/archive/2026-06/` only after the owning task is confirmed closed:

- `scripts/add-snapshot-column.ts`
- `scripts/add-transaction-date.ts`
- `scripts/add-line-manual-discount-column.ts`
- `scripts/update-po-headers.js`
- `scripts/update-inventory-v2.js`
- `scripts/update-btp-dates.ts`
- `scripts/revert-e1-backfill-overreach.ts`
- `scripts/restore-operational-lowercase-sheets.ts`
- `scripts/reset-v2-sheets.ts`
- `scripts/reset-migrated-v2-orders.ts`
- `scripts/rename-v1-sheets-to-legacy.ts`
- `scripts/remigrate-per-audit.ts`
- `scripts/re-migrate-v1-to-v2.ts`
- `scripts/migrate.js`
- `scripts/migrate-units-to-ids.ts`
- `scripts/migrate-units-to-ids.js`
- `scripts/migrate-to-sheets.js`
- `scripts/migrate-orders-to-v2.ts`
- `scripts/migrate-line-discount-split.ts`
- `scripts/migrate-historical-promotions.ts`
- `scripts/migrate-data.ts`
- `scripts/fix-ws7-migration-issues.ts`
- `scripts/fix-subtotal-and-line-discounts.ts`
- `scripts/fix-product-discount-overrides.ts`
- `scripts/fix-phd522-and-uck161.ts`
- `scripts/fix-phd000522-promo.ts`
- `scripts/fix-historical-discounts.ts`
- `scripts/clear-combo-order-discount.ts`
- `scripts/cleanup-test-orders-v2.ts`
- `scripts/cleanup-migrated-v1-orphan-ledger.ts`
- `scripts/cleanup-duplicated-migrated-order-ledger.ts`
- `scripts/backfill-orders-subtotal.ts`
- `scripts/backfill-inferred-high-promo-id.ts`
- `scripts/backfill-e1-edit-bug.ts`
- `scripts/canonicalize-dau-say-modifier-snapshots.ts`
- `scripts/apply-cogs-recalc.ts`
- `scripts/apply-purchase-ledger-cleanup.ts`
- `scripts/apply-order-modifier-qty-cleanup.ts`
- `scripts/apply-order-ledger-net-corrections.ts`
- `scripts/apply-negative-stock-adjustments.ts`
- `scripts/apply-modifier-recipe-normalization.ts`
- `scripts/apply-mac-cogs-recalc.ts`

## Investigation Scripts To Archive Or Delete

These are likely diagnostic scratch scripts. Archive first if they encode useful business cases; delete only after confirming no roadmap reference remains:

- `scripts/investigate-topping-cogs.ts`
- `scripts/investigate-revenue-mismatch.ts`
- `scripts/investigate-revenue-anomaly.ts`
- `scripts/investigate-pnl-bugs.ts`
- `scripts/investigate-negative-stock.ts`
- `scripts/investigate-dao-mieng.ts`
- `scripts/investigate-caphe-da.ts`
- `scripts/investigate-caphe-da-detail.ts`
- `scripts/inspect.ts`
- `scripts/inspect-uck000161.ts`
- `scripts/inspect-uck000094.ts`
- `scripts/inspect-phd000522.ts`
- `scripts/inspect-order-v2.ts`
- `scripts/inspect-lines.ts`
- `scripts/list-all-v2-orders.ts`
- `scripts/spotcheck-mod004.ts`
- `scripts/find-revenue-anomalies-broad.ts`
- `scripts/find-promo-undercount-bugs.ts`
- `scripts/find-promo-plus-order-discount.ts`
- `scripts/diff-promo-id-loss.ts`
- `scripts/classify-promo-context.ts`
- `scripts/classify-orphan-order-ledger.ts`
- `scripts/classify-order-ledger-audit.ts`
- `scripts/check-sp-yields.ts`
- `scripts/check-semi-product-usage.ts`
- `scripts/check-mod-recipes.ts`
- `scripts/check-cogs-table.ts`

## Docs To Review For Staleness

These docs appear to be older phase/spec artifacts. Keep the most recent roadmap and handoff as active; mark old plans/specs as archived if they are no longer used:

- `docs/superpowers/specs/2026-06-10-revenue-cogs-profit-audit-design.md`
- `docs/superpowers/specs/2026-06-10-performance-optimization-design.md`
- `docs/superpowers/specs/2026-06-11-audit-assignment.md`
- `docs/superpowers/specs/2026-06-11-architecture-refactoring-assignment.md`
- `docs/superpowers/specs/2026-06-13-wave1-audit-assignment.md`
- `docs/superpowers/specs/2026-06-13-wave2-audit-assignment.md`
- `docs/superpowers/specs/2026-06-13-wave3-audit-assignment.md`
- `docs/superpowers/specs/2026-06-15-revenue-audit-assignment.md`
- `docs/superpowers/specs/2026-06-15-revenue-re-audit-assignment.md`
- `docs/superpowers/plans/2026-06-10-revenue-cogs-profit-audit.md`
- `docs/superpowers/plans/2026-06-10-performance-optimization.md`
- `docs/superpowers/plans/2026-06-11-architecture-refactoring-plan.md`
- `docs/superpowers/plans/2026-06-13-wave1-refactoring-plan.md`
- `docs/superpowers/plans/2026-06-13-wave2-refactoring-plan.md`
- `docs/superpowers/plans/2026-06-13-wave3-refactoring-plan.md`
- `docs/audits/script-cleanup-plan.md`
- `docs/audits/sheet-cleanup-plan.md`

## Dead Export / Unused Type Candidates

No deletion proposed yet. Run a dedicated static audit before removing exports:

- Search for unused helpers in `lib/sheets_db.ts` after adding batch APIs.
- Search for old V1 order/report helper exports after V2 cutover.
- Search for duplicate inventory action paths between `app/admin/inventory/actions.ts` and nested inventory modules.
- Search for duplicate report allocation helpers after MAC breakdown refactor.

## Proposed Cleanup Phases

1. Archive one-off investigation scripts with no current references.
2. Archive historical migration scripts that have completed run logs.
3. Consolidate duplicate docs into current roadmap, handoff, and domain dictionary.
4. Run static unused export audit and remove dead exports in small commits.
5. Re-run full verification gates after every cleanup phase.
