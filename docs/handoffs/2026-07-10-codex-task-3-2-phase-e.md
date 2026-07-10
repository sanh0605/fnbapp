# Codex Prompt — Task 3.2 Phase E: Integration Smoke Test

Date: 2026-07-10
Owner: Codex (Engine Lead)
Trigger: Task 3.2 Phases A-D deployed. Need production integration verification before relying on pipeline for real backdated events.

## Background

Task 3.2 engine + UI shipped (commits c561e43, 2d86c45, d686b37, b6f2895, 03c54a0). Migrations 0014 + 0015 deployed. Phase D added 15 unit tests with in-memory fixtures and mocks.

Gap: no integration test verifies the **live** pipeline end-to-end:
- Trigger fires on real `stock_ledger` INSERT
- Event row lands in `backdated_ledger_events` with correct fields
- `recomputeEventDryRun` returns a valid plan from production data
- Cleanup leaves no residual test data

This Phase E closes that gap with one CLI script.

## Goal

Create `scripts/verify-backdated-detection-end-to-end.ts` — a standalone integration smoke test against production Supabase. Safe to run repeatedly. Self-cleaning. Not part of vitest suite (would mutate production DB on CI).

## Scope

| Item | In scope | Out of scope |
|---|---|---|
| Single CLI script | ✓ | |
| Real Supabase production DB | ✓ | Local Postgres / mock |
| Trigger verification | ✓ | Trigger unit tests (Phase D has them) |
| RPC contract verification | ✓ | RPC unit tests (Phase D has them) |
| Dry-run only | ✓ | `recomputeEventApply` (mutates real data) |
| Cleanup atomic | ✓ | |
| Commit script to repo | ✓ | Run on CI / vitest |

## Implementation

### Files

| File | Action | Purpose |
|---|---|---|
| `scripts/verify-backdated-detection-end-to-end.ts` | Create | Integration smoke test |

### Script flow

1. **Load env**: `dotenv.config({ path: ".env.local" })` (matches pattern in `scripts/audit-mac-drift-baseline.ts`)

2. **Pre-flight check**:
   - Verify `process.env.SUPABASE_URL` and `process.env.SUPABASE_SECRET_KEY` are set
   - If missing: exit with clear error message (do NOT proceed)

3. **Generate test identifiers** (use timestamp + random suffix to avoid collision across runs):
   ```ts
   const runId = Date.now();
   const TEST_LEDGER_ID = `STK-TEST-PHASEE-${runId}`;
   const TEST_ITEM = `TEST-PHASEE-${runId}`;
   const TEST_PO_ID = `PO-TEST-PHASEE-${runId}`;
   const BACKDATE_MINUTES = 60;
   ```

4. **Insert backdated stock_ledger row**:
   ```ts
   const backdatedAt = new Date(Date.now() - BACKDATE_MINUTES * 60 * 1000).toISOString();
   await supabase.from("Stock_Ledger").insert({
     id: TEST_LEDGER_ID,
     item_reference: TEST_ITEM,
     transaction_type: "PO_RECEIPT",
     quantity_change: 10,
     unit_cost: 5000,
     reference_id: TEST_PO_ID,
     source: "purchase_orders",
     created_at: backdatedAt,
   });
   ```

5. **Wait briefly** (300ms) for trigger to process, then query:
   ```ts
   const { data: events } = await supabase
     .from("backdated_ledger_events")
     .select("*")
     .eq("source_id", TEST_PO_ID);
   ```

6. **Verify trigger fired**:
   - Assert exactly 1 event exists
   - Assert event.status === "PENDING"
   - Assert event.effective_timestamp matches inserted `created_at`
   - Assert event.visibility_timestamp > event.effective_timestamp
   - Assert event.item_reference === TEST_ITEM
   - Assert event.quantity_change === 10
   - Assert event.unit_cost === 5000

7. **Dry-run recompute**:
   ```ts
   const plan = await recomputeEventDryRun(event.id);
   ```
   Verify:
   - `plan.event_id === event.id`
   - `plan.run_id === \`backdated-${event.id}\``
   - `plan.source_hash` is 64-char hex (SHA-256)
   - `plan.affected_lines.length === 0` (synthetic item not in any recipe)
   - `plan.changes.length === 0` (no affected lines → no changes)

8. **Cleanup (always run, even on failure)**:
   - DELETE from `backdated_ledger_events` where `source_id = TEST_PO_ID`
   - DELETE from `Stock_Ledger` where `id = TEST_LEDGER_ID`
   - Verify 0 residual rows in both tables for test identifiers

9. **Print structured output**:
   - Use a `Step[]` accumulator with `{ name, status: PASS|FAIL|INFO, detail? }`
   - Print each step as it runs
   - Summary at end: `X PASS, Y FAIL, Z INFO`
   - Exit code 0 if all PASS, 1 if any FAIL

### Error handling

- Wrap main flow in try/catch
- In catch: still run cleanup, then re-throw or exit 1
- Any FAIL step should not abort subsequent verification steps (continue + summarize at end)
- If trigger fails to fire: do NOT silently clean up — log warning that residual stock_ledger row may exist, then clean up anyway

### Output example

```
=== Task 3.2 Phase E: Integration Smoke Test ===

Test ledger ID: STK-TEST-PHASEE-1783667624669
Test item: TEST-PHASEE-1783667624669
Test PO: PO-TEST-PHASEE-1783667624669
Backdate: 60 minutes

--- Step 1: Insert backdated stock_ledger row ---
[PASS] Insert stock_ledger: STK-TEST-PHASEE-1783667624669

--- Step 2: Verify trigger fired ---
[PASS] Trigger fired: event_id=abc-123
[INFO] Event status: PENDING
[INFO] Effective timestamp: 2026-07-10T05:42:00Z
[INFO] Visibility timestamp: 2026-07-10T06:42:00Z
[INFO] Item reference: TEST-PHASEE-1783667624669
[INFO] Quantity change: 10

--- Step 3: Dry-run recompute ---
[PASS] Dry-run succeeded
[INFO] Affected lines: 0
[INFO] Changes: 0
[INFO] Run ID: backdated-abc-123
[PASS] Expected behavior: 0 affected lines (synthetic item not in any recipe)

--- Step 4: Cleanup ---
[PASS] Delete event
[PASS] Delete stock_ledger
[PASS] Cleanup verified: Both tables clean

=== Summary: 5 PASS, 0 FAIL, 6 INFO ===
```

## Verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 335/335 pass (no new unit tests; integration test is CLI-only)
- Manual run: `npx vite-node scripts/verify-backdated-detection-end-to-end.ts` → all PASS
- After run: query `SELECT * FROM backdated_ledger_events WHERE source_id LIKE 'PO-TEST-PHASEE-%'` → expect 0 rows (cleanup verified)

## Commit

Single commit:
```
Codex test: Task 3.2 Phase E integration smoke test for backdated detection pipeline
```

Commit body:
- Standalone CLI script (not in vitest suite)
- Verifies trigger + event row + dry-run plan end-to-end against production
- Self-cleaning with verified cleanup
- Safe to run repeatedly (timestamp-based IDs prevent collision)

## Out of scope (do NOT do)

- Do NOT call `recomputeEventApply` (would mutate real data — that path is for real events only)
- Do NOT add this to vitest config (would mutate production DB on every CI run)
- Do NOT modify migrations 0014 or 0015
- Do NOT modify lib/backdated-ledger/* source files (test consumes them as-is)
- Do NOT skip cleanup under any circumstance (always run cleanup, even on failure)
- Do NOT use real item_reference or PO IDs (always synthetic with `TEST-PHASEE-` prefix)
- Do NOT deploy anything

## Coordination

- Phase E is the final verification gate for Task 3.2 before relying on it for real events
- After Phase E commit + Claude verifies script runs clean:
  - Task 3.2 fully complete
  - Wait for first real operator backdate (within 1 week per user interview)
  - First real event: admin opens UI, approves, verifies drift = 0
- Codex Phase E may run in parallel with Antigravity UI sweep (if user starts it next)

## If blocker encountered

Likely blockers:
- Trigger doesn't fire: investigate by querying `pg_trigger` for `detect_backdated_ledger_entry`. Could be migration 0014 not applied (verify via `supabase migration list`).
- RPC call fails: check `pg_proc` for `apply_backdated_event_recovery`, `mark_backdated_event_recomputed`, `reject_backdated_event`. Should all exist after migration 0015.
- Cleanup fails: print clear warning, exit non-zero, ask Claude to manually clean via Dashboard.

Pause + document with `WIP - blocked:` prefix if any blocker can't be resolved.
