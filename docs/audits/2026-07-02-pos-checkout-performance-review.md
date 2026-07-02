# POS Checkout Performance And Handoff Review

Date: 2026-07-02

## User-facing result

The bill checkout path no longer downloads the complete stock ledger or the
complete order list. The database now returns a compact inventory state and
saves the order, lines, event, and stock consumption in one transaction.

Measured database work after cached reference data:

- Previous path: approximately 2.1 seconds.
- New path: approximately 0.3 seconds.
- Improvement: approximately 7 times faster in the current environment.

The final user-perceived time also includes browser rendering, authentication,
and network conditions.

## Data protection

- Pre-deployment snapshot: `recovery-20260702T024525324Z`.
- Snapshot verification: 108/108 files valid.
- Manifest SHA-256:
  `4901AF1EAE35C918B278D386BA48C489C91E7625CC5000FD317E3E1199B68316`.
- Snapshot contents: 9,664 Google Sheets rows and 10,782 Supabase rows.
- Migration `0008_pos_checkout_performance.sql` is deployed.
- Forced mid-transaction failure left 0 test orders and 0 test lines.
- Compact inventory state matched the legacy calculation for all 48 observed
  items with 0 mismatches across 5,998 ledger rows.

## Claude and Antigravity handoff review

### Accepted

- `batch_yield` is the correct denominator for semi-product recipe fallback.
  The two admin cost screens now align with the canonical MAC engine.
- `FLAT_VND` is the correct database and engine identifier for a fixed cash
  discount. A direct regression test now covers two-item discount behavior.
- POS `status === "ACTIVE"` filtering follows the domain dictionary.
- Standalone topping setup is idempotent: all 7 mappings exist and dry-run
  proposes 0 writes.
- Standalone topping report mapping uses the stored modifier link and has
  regression coverage for canonical modifier consolidation.
- The standalone topping toggle checks ADMIN permission and limits mutation to
  category `CAT-007`.
- June sales import verification is complete: 77 orders, 110 lines, 77 events,
  and 61 stock-consumption rows are present and linked.

### Caveats

- June import COGS differs from its old preview by 1 VND due to final rounding.
  This is immaterial and the imported records are structurally complete.
- `scripts/import-june-2026-sales.ts` uses the retired multi-step write helper
  and randomized historical timestamps. It must remain historical evidence and
  must not be rerun for new imports.
- Untracked debug scripts from another session currently produce TypeScript
  errors. They were preserved and were not included in the POS commit.

## Verification

- Vitest: 253/253 passed across 44 files.
- POS inventory-state audit: 0 mismatches.
- P&L MAC consistency: 0 VND delta.
- Database migration list: local and remote both include `0008`.
- Dev server for manual testing: `http://localhost:3003`.

## Separate data work

These issues predate the checkout optimization and were not modified:

- 3 negative-stock ingredients.
- 164 historical MAC COGS line mismatches, aggregate delta +119,036 VND.

They require separate reviewed recovery plans and fresh snapshots before any
write.
