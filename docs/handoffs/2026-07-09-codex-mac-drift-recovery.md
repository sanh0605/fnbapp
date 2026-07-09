# Codex Prompt — MAC drift baseline recovery (164 lines)

Date: 2026-07-09
Owner: Codex (Engine Lead)
Priority: 3 (per Codex roadmap)
Estimated effort: ~3-5 hours (investigation + recovery script)

## Goal

Diagnose and recover the +119,036 VND MAC drift across 164 ledger lines introduced by June 2026 backfill commits. User chose Option A: leave as audit baseline with locked IDs (per earlier session). This task is to:
1. Produce a clear diagnostic report
2. Lock the 164 affected ledger IDs as audit baseline
3. Document recovery options in case user changes mind

## Background

From earlier audit:
- June 2026 backfill commits (re-migrating v1 → v2 orders) introduced MAC calculation drift
- 164 ledger lines affected
- Total drift: +119,036 VND (over-stated COGS)
- Pattern: backfill used different MAC computation than production checkout path
- Pre-existing (not caused by recent migration work)

User decision (earlier session): "Option A — leave as audit baseline with locked IDs"

## Phase A: Diagnostic (read-only)

Produce `docs/audits/2026-07-09-mac-drift-baseline-audit.md` with:

### 1. Drift identification

Query `stock_ledger` to find the 164 affected lines. Likely criteria:
- `transaction_type = 'PURCHASE_RECEIPT'` OR `'PRODUCTION_OUTPUT'` OR `'SALES_CONSUME'`
- Date range: June 2026 (or earlier if backfill touched older data)
- Created by backfill scripts vs original checkout

Compare expected MAC (using current `lib/mac-cogs.ts`) vs stored `cost_at_sale` for affected orders.

### 2. Sample 10 affected lines

For each:
- order_id, line_id
- transaction_type
- item_reference
- quantity_change
- stored cost_at_sale
- expected cost_at_sale (recomputed via current MAC)
- delta
- root cause hypothesis

### 3. Aggregate impact

- Total delta: +119,036 VND
- Per item breakdown
- Per order breakdown (if relevant)
- Per date breakdown

### 4. Recovery options

Document 3 options with trade-offs:

**Option A (current)**: Leave as audit baseline. Lock the 164 IDs. Document in audit.
- Risk: 0 (no data change)
- Trade-off: P&L for affected period is +119,036 VND off

**Option B**: Recompute affected `cost_at_sale` values using current MAC logic.
- Risk: medium (modifies historical COGS)
- Trade-off: more accurate P&L, but loses audit trail of original computation

**Option C**: Add compensating adjustment ledger entries.
- Risk: low
- Trade-off: doesn't touch originals, adds new "audit correction" entries

User already picked A. Document the decision rationale.

## Phase B: Lock baseline (small data change)

Add a column or marker to identify the 164 lines as "audit baseline, do not modify":

Option B1: Create table `audit_baseline_locks` with `ledger_id, locked_at, locked_by, reason`:
```sql
CREATE TABLE public.audit_baseline_locks (
  ledger_id text primary key,
  locked_at timestamptz not null default now(),
  locked_by text not null,
  reason text not null
);
ALTER TABLE public.audit_baseline_locks enable row level security;
revoke all on table public.audit_baseline_locks from public, anon, authenticated;
grant select, insert on table public.audit_baseline_locks to service_role;
```

Option B2: Add `audit_locked_at timestamptz` column to `stock_ledger`:
- Simpler (one column)
- Risk: schema change on critical table

**Recommend Option B1** — separate table, doesn't modify hot table.

Populate the 164 IDs from the diagnostic.

## Phase C: Recovery script (deferred — user decision)

Write `scripts/recover-mac-drift.ts` but DO NOT apply. Mark as ready for future decision.

Script should:
- Default `--dry-run`
- Require `--apply` to execute
- Print before/after for each affected order
- Compute new cost_at_sale using current MAC
- Update in atomic transaction
- Insert audit entry referencing the lock table

## Verification

Phase A:
1. Read-only, no DB writes
2. Audit doc committed

Phase B:
1. New table created via `supabase db push`
2. 164 IDs inserted
3. `npx tsc --noEmit` → 0 errors
4. `npx vitest run` → 308+ tests pass
5. Verify lock by attempting to update a locked ledger row (should fail or warn)

Phase C (if user later approves):
1. Dry-run output reviewed
2. Snapshot captured
3. Apply in atomic transaction
4. Audit entry logged

## Commits

Suggested:
1. `Codex docs: MAC drift baseline audit (164 lines, +119,036 VND)` — Phase A
2. `Codex feat: audit_baseline_locks table + populate (Phase B)` — Phase B
3. (deferred) `Codex feat: recover-mac-drift script (dry-run, awaiting user approval)` — Phase C

## Out of scope

- Do NOT actually apply recovery without explicit user approval
- Do NOT modify production ledger rows
- Do NOT touch recent migration work (Hồng→Lục is independent)
- Do NOT fix the underlying MAC computation (already correct in production checkout)

## Coordination

This is FINANCIAL work. Coordinate carefully:
- Phase A: read-only, safe
- Phase B: small schema change, requires deploy
- Phase C: NOT this task, defer to separate user decision

If findings in Phase A change the analysis significantly (e.g., not 164 lines, or drift is negative not positive), pause and report.
