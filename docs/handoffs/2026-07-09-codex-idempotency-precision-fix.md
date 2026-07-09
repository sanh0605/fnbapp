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

## Fix (Codex evaluates and picks)

Claude identified 3 viable options. **Codex evaluates all 3, picks the most appropriate based on engine judgment, and documents the reasoning in the commit message.**

### Option A: Change column type to full precision

```sql
ALTER TABLE public.stock_ledger
  ALTER COLUMN quantity_change TYPE numeric;
```

**Pros:** Full precision stored, future-proof for any calculation
**Cons:** Schema change affects ALL stock_ledger queries, potential money integrity implications, larger migration

### Option B: Round at write_set generation (app-side)

In `lib/hong-luc-migration.ts` (or wherever write_set is built), round quantity_change to 6 decimals before storing in write_set:

```ts
quantity_change: Math.round(Number(q) * 1e6) / 1e6
```

**Pros:** write_set accurately reflects what DB stored
**Cons:** Existing write_sets (already in `data_migration_runs`) still have full precision → those reruns still fail unless combined with Option C

### Option C: Round at comparison (SQL-side)

In migration 0011, update the multiset comparison to round expected:

```sql
round((expected->>'quantity_change')::numeric, 6) as quantity_change,
```

**Pros:** Works retroactively on existing write_sets, minimally invasive
**Cons:** Hardcodes 6-decimal assumption in comparison logic

### Codex's decision criteria

Pick the option that:
1. Minimizes blast radius (avoid schema change if unnecessary)
2. Works retroactively (existing reruns must succeed)
3. Maintains data integrity
4. Is testable

If Codex picks Option C, also add regression test that verifies SQL text contains `round(`. If Codex picks A or B, document why C was insufficient.

## Verification (regardless of option picked)

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 315+/315+ pass
3. **Deploy to Supabase** via `SUPABASE_DB_PASSWORD=<pwd> supabase db push`
4. **Re-run apply** with same snapshot:
   ```
   npx vite-node scripts/migrate-hong-tra-to-luc-tra.ts --apply --snapshot-id recovery-20260706T053239562Z
   ```
5. **Verify** output contains `already_applied: true` (not error)

## Commit

Single commit:
```
Codex fix: idempotency precision handling in apply_hong_to_luc_migration (Task 2.1)
```

Commit body should document:
- Which option (A/B/C) was picked
- Why other options were rejected
- Trade-off analysis

## Also: recommend priority order for remaining tasks

After Task 2.1, Codex has 2 remaining tasks:
- Task 3: MAC drift baseline recovery (164 lines, +119,036 VND, financial scope)
- Task 4 implementation: Timezone display (1 ALTER ROLE command, UX)

**User direction:** Sequence by system impact priority.

In Task 2.1 commit body (or separate recommendation doc), Codex should propose:
- Which task to do next (Task 3 or Task 4)
- Reasoning based on system impact
- Estimated risk + effort

## Coordination

- Migration 0010 already deployed but ineffective
- Migration 0011 will supersede via CREATE OR REPLACE FUNCTION (Option C) OR ALTER TABLE (Option A)
- Claude will deploy 0011 + verify rerun after Codex commits
