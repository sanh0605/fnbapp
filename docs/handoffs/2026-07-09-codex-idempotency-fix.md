# Codex Prompt — Migration RPC idempotency rerun edge case

Date: 2026-07-09
Owner: Codex (Engine Lead)
Priority: 2 (per Codex roadmap)
Estimated effort: ~30 min - 1 hour

## Bug

The Hồng→Lục trà chanh migration (`apply_hong_to_luc_migration` RPC) succeeds on first run but FAILS on idempotent rerun with:

```
apply_hong_to_luc_migration: Partial migration state: target ledger fingerprint mismatch
```

Migration itself is verified correct (4 orders migrated, 32 ledger rows, REC-068 deleted, balances match projection). The bug is in the **rerun safety check** — when `data_migration_runs` row exists with matching params but the live state differs from expected, the RPC raises instead of returning `already_applied: true`.

## Root cause (hypothesis)

The RPC at `supabase/migrations/0009_hong_to_luc_migration.sql` lines ~138-178 runs 6 separate `exists(...)` checks:
- migration events exist
- 4 lines target PROD-042/VAR-051
- ledger fingerprint matches target
- recipe (REC-068) absent

When ALL pass → returns `already_applied: true`.
When ANY fail → raises `Partial migration state: ...`.

The ledger fingerprint check compares current ledger rows against the stored `write_set.ledgerAfter`. Generated IDs (`stk-hong-luc-<hash>`) and possibly other transient fields differ between expected and actual, so the comparison fails even when content matches.

## Investigation steps

1. Read `supabase/migrations/0009_hong_to_luc_migration.sql` lines 126-209 (the existing-run branch)
2. Identify the exact fingerprint comparison logic
3. Determine which fields differ between expected and actual:
   - `id` (generated `stk-hong-luc-<hash>` vs expected)?
   - `created_at` (timing drift)?
   - Other transient fields?
4. Decide fix approach (see options below)

## Fix options

### Option A (recommended): Exclude transient fields from fingerprint

Compare only semantically-meaningful fields:
- `transaction_type`
- `item_reference`
- `quantity_change`
- `source`
- `reference_id`

Exclude:
- `id` (generated, not stable)
- `created_at` (timing-dependent)
- Any other auto-generated fields

This makes the check robust to ID-generation strategy.

### Option B: Skip ledger fingerprint check if events + lines match

If `data_migration_runs` row exists AND all 4 lines already target PROD-042/VAR-051 AND all 4 migration events exist → return `already_applied: true` without checking ledger fingerprint.

Rationale: if events exist and lines are correct, the ledger must have been written in the same transaction. Ledger check is redundant.

Risk: weaker verification. Less defensive.

### Option C: Hash ledger content instead of rows

Compute hash over `SELECT transaction_type, item_reference, quantity_change, source FROM stock_ledger WHERE reference_id IN (...) ORDER BY ...` — excludes ID and timestamp.

## Recommended approach

Option A. Excluding transient fields from comparison is the standard pattern for content-fingerprint checks. Document in commit body why.

## Files

- `supabase/migrations/0009_hong_to_luc_migration.sql` (apply migration to update the RPC)
- May need new migration file `0010_hong_to_luc_idempotency_fix.sql` with `CREATE OR REPLACE FUNCTION`

## Test plan

Add test in `lib/hong-luc-migration-transaction.test.ts`:

```ts
test("rerun after successful apply returns already_applied: true", async () => {
  // Mock: data_migration_runs row exists, all 4 lines migrated, all events exist
  // Call applyHongToLucMigration
  // Assert: returns { already_applied: true, ... } without raising
});
```

If mocking is complex, write a SQL-level test that calls the RPC twice against a test database.

## Verify

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass (add 1-2 new tests)
3. Manual: re-run the migration script with `--apply --snapshot-id <existing>`:
   - First run: no-op (already applied) — should return success
   - Currently: raises "Partial migration state"

After fix deployed, the migration can be safely re-applied without manual intervention.

## Commit

Suggested: `Codex fix: idempotency rerun edge case in apply_hong_to_luc_migration (ledger fingerprint excludes transient fields)`

## Deployment

The fix requires running the new migration against Supabase:
```bash
SUPABASE_DB_PASSWORD='<password>' supabase db push
```

Or manual via Supabase SQL Editor.

Coordinate with Claude — don't deploy until reviewed.

## Out of scope

- Do NOT change the actual migration logic (write path is correct)
- Do NOT delete `data_migration_runs` rows
- Do NOT touch the snapshot system
- Do NOT modify the 4 already-migrated orders

## Coordination

This task is INDEPENDENT of other tasks. Can be done first or last.
