# Codex Prompt — Idempotency precision fix (Task 2.1)

Date: 2026-07-09
Owner: Codex (Engine Lead)
Trigger: Task 2 fix (migration 0010) doesn't actually work. Root cause found by Claude via DB debug.

## Bug

Re-running `--apply` after migration success still fails with:
```
apply_hong_to_luc_migration: Partial migration state: target ledger fingerprint mismatch
```

## Root cause

`write_set.ledgerAfter[].quantity_change` stores full JS Number precision:
```
-35.714285714285715
```

But `stock_ledger.quantity_change` (Postgres `numeric` column) is stored rounded to 6 decimal places:
```
-35.714286
```

Migration 0010's multiset comparison (EXCEPT ALL) compares:
```sql
(expected->>'quantity_change')::numeric    -- parses "-35.714285714285715"
vs
ledger.quantity_change                      -- stored as -35.714286
```

These are different numeric values → EXCEPT ALL returns them → check fails.

## Debug evidence

Claude ran `scripts/_tmp-idempotency-debug.ts` (deleted after debug):

```
MISMATCH: SALES_CONSUME|ord-...|ING-001|-35.714286|VARIANT_RECIPE:BTP_SHORTFALL:BTP-009
  expected=0  actual=1
MISMATCH: SALES_CONSUME|ord-...|ING-020|-7.142857|...
  expected=0  actual=1
... 30 mismatches total

Sample expected[0]: quantity_change: -35.714285714285715  (15 sig digits)
Sample actual[0]:   quantity_change: -35.714286           (6 decimal places)
```

All 30 mismatches are precision-related. Other fields (transaction_type, reference_id, item_reference, source) match correctly.

## Fix

Create `supabase/migrations/0011_hong_to_luc_idempotency_precision.sql`:

Update the multiset comparison to round expected quantity to 6 decimals (matching DB storage precision):

```sql
-- In the expected_rows CTE, change:
(expected->>'quantity_change')::numeric as quantity_change,

-- To:
round((expected->>'quantity_change')::numeric, 6) as quantity_change,
```

Same change in actual_rows CTE is not needed (already at 6 decimals), but for symmetry:
```sql
round(ledger.quantity_change, 6) as quantity_change,
```

Also update the regression test in `lib/hong-luc-migration-transaction.test.ts`:
- Current test only verifies SQL text contains "except all"
- Add a test that simulates rerun with precision-rounded values
- Or add a test that verifies the SQL text contains "round(... , 6)"

## Verification

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 315+/315+ pass
3. **Deploy migration 0011 to Supabase** via `SUPABASE_DB_PASSWORD=<pwd> supabase db push`
4. **Re-run apply** with same snapshot:
   ```
   npx vite-node scripts/migrate-hong-tra-to-luc-tra.ts --apply --snapshot-id recovery-20260706T053239562Z
   ```
5. **Verify** output contains `already_applied: true` (not error)

## Commit

Single commit:
```
Codex fix: idempotency precision rounding in apply_hong_to_luc_migration (Task 2.1)
```

## Out of scope

- Don't change write_set storage (full precision is fine for audit trail)
- Don't change stock_ledger column precision (rounding to 6 decimals is intentional for currency-like display)
- Don't touch migration 0009 or 0010 (0011 supersedes via CREATE OR REPLACE)

## Coordination

- Migration 0010 already deployed but ineffective. Migration 0011 will supersede via CREATE OR REPLACE FUNCTION.
- Claude will deploy 0011 + verify rerun after Codex commits.
