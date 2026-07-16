# BTP Recipe Replay Drift Policy

Date: 2026-07-16
Status: Active policy
Owner: Claude (coordinator); Codex (engine implementation); Business owner (decision authority)

## Plain-language summary

When the kitchen changes the recipe for a semi-finished product (BTP — bán thành phẩm, e.g., "Trà đen BTP-002"), every older order that used that BTP will show a different cost when re-calculated by the audit script. This is **expected behavior, not a bug**.

**The recorded cost at the time of sale was correct.** Financial reports (revenue, COGS, gross profit) use the recorded cost and are **not affected**. Only the audit script — which re-calculates from current data to verify consistency — reports a difference.

## Technical mechanism

### What gets pinned at sale time

When a POS order is created (`app/pos/actions.ts`) or an admin edits an order (`app/admin/orders/actions.ts`):

1. The order line stores `recipe_snapshot_json` — the **top-level product/modifier recipe** at sale time.
2. The line also stores `cost_at_sale` — the MAC cost computed using the visible BTP state at that moment.
3. The MAC formula uses `buildLineConsumptionRows` + `computeMacCostForConsumptionRows` with the ledger state visible at sale time.

### What does NOT get pinned

The order line does **not** store a snapshot of the **nested BTP recipe** used for shortfall decomposition. When BTP stock is insufficient at sale time, the engine decomposes the shortfall into base ingredients using the **current** BTP recipe (e.g., BTP-002 currently pointing to RC-031 with ING-004 quantity 150).

### Why this causes replay drift

The audit script (`lib/mac-cogs-audit.ts` → `auditMacCogsDrift`) re-runs MAC computation for each historical order line to verify that stored `cost_at_sale` matches a fresh replay. The replay:

1. Loads the order line's `recipe_snapshot_json` (top-level — correct).
2. Loads **current** BTP recipe for shortfall decomposition (current BTP state — may differ from sale time).
3. Computes expected cost.
4. Compares to stored `cost_at_sale`.

If the BTP recipe changed between sale time and audit time, step 2 uses a different recipe than what was used at sale time → expected cost differs → audit reports drift.

**The drift is in the replay, not in the stored value.** Stored `cost_at_sale` is unchanged and was correct when written.

### Empirical evidence (Task 3.6)

- 71 frozen post-cutoff lines (2026-07-03 to 2026-07-14) totaling -67,221 VND replay drift.
- 64/71 reproduced exactly when sale-time BTP recipe is used in replay.
- 7/71 reproduced with the immediately-previous BTP recipe (ambiguous: schema lacks `Recipes.recorded_at`, cannot distinguish backdated insert from stale view).
- 42 additional newer lines: durable late PO receipts (migration 0014 captured, expected backdating behavior).
- Total: 113 lines, -60,412 VND replay drift.
- POS write formula vs audit replay formula: 0/113 difference. **No engine bug.**

## Financial impact

**None.** Stored COGS is what flows into P&L reports. The replay drift is an audit-script reporting artifact only.

| Report / use case | Source | Affected by replay drift? |
|---|---|---|
| P&L (`getPnLDataV2`) | `Order_Lines_V2.cost_at_sale` (stored) | No |
| Sales report (`getSalesDataV2`) | `Order_Lines_V2` revenue fields (stored) | No |
| Inventory valuation | `Stock_Ledger.quantity_change` × MAC | No |
| MAC drift audit script | Fresh replay | Yes (this is the drift) |
| Backdated ledger detection | `backdated_ledger_events` (migration 0014) | No |

## Policy

### Accept as audit drift

The 113 forward-drift lines identified in Task 3.6 plus the 112 historical outside-cohort lines identified in Task 3.4 (90 PRE_BASELINE_WINDOW + 22 BASELINE_SELECTION_GAP) are accepted as audit drift.

- **Total: 225 lines** locked in `audit_baseline_locks`.
- **Reason**: `BTP_RECIPE_REPLAY_DRIFT` — temporal asymmetry, stored COGS correct at sale time.
- **Source hash**: SHA-256 of the combined evidence JSON.
- **No recompute**: stored values were correct when written; recomputing would retroactively apply current recipe to historical orders (wrong).

### Future BTP recipe edits

When the kitchen changes a BTP recipe:

1. **Before**: note the date and affected BTP IDs.
2. **After**: expect the MAC drift audit to show new mismatches on historical orders consuming that BTP.
3. **Triage**: classify new mismatches using Task 3.6 pattern (sale-time recipe reproduces stored → replay drift, lock cohort).
4. **Lock**: insert new cohort into `audit_baseline_locks` with reason `BTP_RECIPE_REPLAY_DRIFT` and source hash.
5. **Do not** recompute stored COGS.

### What would change this policy

This policy would be revisited if any of the following becomes true:

1. **Financial impact discovered**: stored COGS shown to be wrong at sale time (would invalidate the "replay drift only" framing).
2. **Drift volume material**: replay drift exceeds ~500,000 VND in a single cohort (would warrant engine fix to pin nested BTP recipe).
3. **Regulatory/audit requirement**: external auditor requires replay to match stored COGS exactly (would require engine fix).
4. **Operator confusion**: drift reports cause ongoing operator confusion that process documentation cannot resolve.

In any of these cases, the remediation is **Task 3.7 option A**: pin nested BTP recipe in `Order_Lines_V2.btp_recipe_snapshot_json`, update POS write path, update audit replay to use snapshot. This is a 3-5 Codex session effort.

## Cohort lock implementation

- Applied: 2026-07-16 by Codex after Claude approved source hash
  `a24f0d1fba13f1c73e853055ada598b3227b94ed7e788720a6e3948fc8c48c2e`
  and the exact 225-line payload.
- Migration: existing `0012_mac_drift_baseline_locks.sql`; no new migration.
- Script: `scripts/lock-btp-recipe-replay-drift-cohort.ts`, dry-run by
  default with an explicit `--apply` production gate.
- Atomic result: one bulk INSERT added 225 cohort rows. Total locks moved from
  170 to 395. The 40 recovered lines are a subset of the original 170 baseline
  locks, not an additional lock population.
- Verification: 225/225 cohort rows match the approved hash and values;
  225/225 `cost_at_sale` values remained unchanged; a sample no-op UPDATE was
  blocked with `audit-baseline locked`.
- Idempotency: the post-apply dry-run returned `ALREADY_APPLIED`, 225 exact
  target locks, zero validation failures, and zero rows to insert.
- Result log: `docs/audits/2026-07-16-task-3.7-lock-result.md`.

## References

- Task 3.4 investigation: `docs/audits/2026-07-15-task-3.4-outside-cohort-investigation.md`
- Task 3.6 investigation: `docs/audits/2026-07-15-task-3.6-forward-drift-investigation.md`
- MAC drift baseline: `docs/audits/2026-07-09-mac-drift-baseline-audit.md`
- E3 recovery result: `docs/audits/2026-07-13-task-3-recovery-result.md`
- Original MAC spec: `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`
