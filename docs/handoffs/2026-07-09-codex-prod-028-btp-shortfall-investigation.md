# Codex Prompt — PROD-028 BTP_SHORTFALL active source investigation (Task 3.1)

Date: 2026-07-09
Owner: Codex (Engine Lead)
Trigger: Task 3 audit revealed active drift source. Locking/recovery deferred until root cause understood.

## Context

Task 3 (commit `be2370e`) audit found 170 mismatched order lines / +119,782 VND baseline. 8 of those lines are NEW (post-2026-07-02) live POS orders for PROD-028 with BTP_SHORTFALL classification. This means drift is still actively growing in production, not just historical backfill.

Recovery (Option B recompute) is deferred until this source is understood. Otherwise recovery is incomplete — new drift appears the next day.

## Active source evidence

From `docs/audits/2026-07-09-mac-drift-baseline-audit.md`:

| Order | Line ID | Delta (VND) |
|---|---|---:|
| PHD000893 | `ol-35ef2d85-9c6b-42e6-a94b-ca822e384423` | +199 |
| PHD000883 | `ol-08bbc0ba-6f00-4aa4-a71c-cec7e96ff08e` | +79 |
| PHD000887 | `ol-db72a765-56c5-4b29-884c-a522cb51eabe` | +79 |
| PHD000890 | `ol-769255d6-4063-46e8-bdd4-8b45108f57d0` | +79 |
| PHD000896 | `ol-11dbf85d-80dc-4ca3-80c0-f54f64563dfe` | +79 |
| PHD000897 | `ol-91b3ca39-dad8-4a2d-b387-f0ad7e6407f3` | +79 |
| PHD000899 | `ol-be44f399-b097-4ccb-a42c-d69e6ef22637` | +79 |
| PHD000894 | `ol-42cc0fcb-2830-4a64-9207-9fac5f763abf` | +40 |

Pattern: mostly +79 VND per line. Suggests consistent BTP shortfall amount per unit.

## Hypothesis space

Codex evaluate, don't assume:

1. **BTP recipe mapping gap**: PROD-028 recipe references a semi-product (BTP) that has no MAC, triggers BTP_SHORTFALL fallback. Fallback uses base-ingredient pricing that doesn't match what sale-time code actually charged.

2. **MAC fallback coverage drift**: Current MAC replay (`lib/mac-cogs-audit.ts`) uses different MAC resolution window than sale-time code (`lib/pos-checkout` or similar). Near-boundary cases resolve to different MAC snapshots.

3. **Sale-time cost_at_sale computation bug**: POS checkout writes `cost_at_sale` using stale MAC or incomplete recipe traversal. MAC replay later computes "correct" value and shows drift.

4. **Recipe change after sale**: PROD-028 recipe was edited after these orders were placed, but `cost_at_sale` was not recomputed. (Less likely — recipe changes should be versioned.)

5. **BTP inventory timing**: Stock was logged with different effective MAC at consume-time vs current MAC replay baseline.

## Investigation plan

Read-only. No DB writes. No code changes.

### Phase A: Identify PROD-028

- Query `Products_V2` for `PROD-028`: name, type, base_unit, current recipe_id, is_active
- Query `Recipes` where `product_id = 'PROD-028'`: ingredient list, BTP references
- Identify all BTP (semi-product) ingredients in PROD-028 recipe

### Phase B: Trace 8 drift lines

For each of the 8 order lines:
- Query `Order_Lines_V2` full row
- Query related `Stock_Ledger` entries (`reference_id` = order_id or item_reference = line_id)
- Query `Semi_Products` for BTP MAC at sale time
- Compare: stored `cost_at_sale` vs MAC replay expected

### Phase C: BTP_SHORTFALL classification logic

Read `lib/mac-cogs-audit.ts` and any BTP_SHORTFALL classification code:
- What conditions trigger this classification?
- How is fallback cost computed at sale time vs audit replay?
- Where do the two paths diverge?

### Phase D: Timeline correlation

- When was PROD-028 first sold? (earliest order with this product)
- When did first BTP_SHORTFALL drift appear?
- Correlate with git log changes to `lib/pos-checkout`, `lib/mac-cogs`, recipe files for PROD-028
- Identify commit (if any) that introduced the divergence

### Phase E: Reproduce locally

Write `scripts/debug-prod-028-btp-shortfall.ts` that:
- Picks 2 sample orders (e.g., PHD000883 +79, PHD000893 +199)
- Traces sale-time cost computation step by step
- Traces MAC replay computation step by step
- Prints divergence point with values

## Deliverables

1. **Audit doc**: `docs/audits/2026-07-09-prod-028-btp-shortfall-investigation.md`
   - Hypothesis confirmed/rejected with evidence
   - Reproduction trace for 2 sample lines
   - Root cause explanation
   - Recommended fix scope (recipe change, code fix, MAC backfill, etc.)
   - Estimated blast radius of fix (how many historical lines affected)

2. **Debug script**: `scripts/debug-prod-028-btp-shortfall.ts` (read-only)

3. **Recommendation**: Should Task 3 recovery (Option A lock + Option B recompute) proceed after fix, or does the fix itself change the baseline?

## Verification

- `npx tsc --noEmit` -> 0 errors
- `npx vitest run` -> 320/320 pass (no new tests, but existing must pass)
- No DB writes
- No migration deploy
- No Supabase RPC calls that mutate state

## Commit

Single commit:
```
Codex docs: PROD-028 BTP_SHORTFALL active drift investigation (Task 3.1)
```

Commit body should document:
- Confirmed root cause hypothesis
- Recommended fix scope (1-line summary)
- Whether Task 3 recovery proceeds as-is or needs revision

## Out of scope (do NOT do)

- Do NOT fix the bug yet (separate task)
- Do NOT deploy migration 0012
- Do NOT insert any lock rows
- Do NOT run `recover-mac-drift.ts --apply`
- Do NOT edit any recipes

## After Task 3.1

User will review audit doc and decide:
- Task 3.2 (fix active source) before Task 3 recovery, OR
- Task 3 recovery (Option A lock) proceeds in parallel with Task 3.2 fix

Codex's recommendation in commit body will inform this sequencing decision.

## Coordination

- Claude has reviewed Task 3 deliverables (commit `be2370e`)
- Migration 0012 is local-only, not deployed
- 170-line baseline artifact is at `docs/audits/2026-07-09-mac-drift-baseline-lines.json`
- Recovery plan dry-run is at `docs/audits/2026-07-09-mac-drift-recovery-plan.json`
