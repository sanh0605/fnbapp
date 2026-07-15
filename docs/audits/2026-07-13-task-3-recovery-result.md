# Task 3 E3 Selective Recovery Result

Date: 2026-07-13

Status: Applied and cohort-verified; no rollback required

## Outcome

Task E3 recovered the exact 40 `PURCHASE_COST_RECOVERY` order lines identified
by Task 3.3. The production RPC used run ID
`task-3-recovery-2026-07-13-081930193Z` and source SHA-256
`cd0a2b13d6e52cf7cd53dd8223b805686c7fa579ef76a245a588d484fe630dc3`.

The RPC completed atomically with `change_count = 40`,
`total_delta_vnd = -933`, `dry_run = false`, and
`already_applied = false`. It updated the 40 stored COGS values and inserted
40 matching rows into `data_recovery_changes` in the same transaction.

## Before and after

| Measure | Before E3 | After E3 | Change |
|---|---:|---:|---:|
| Fixed baseline locks | 170 | 170 | 0 |
| Recovered lines matching reviewed MAC | 0 | 40 | +40 |
| Remaining locked mismatch lines | 170 | 130 | -40 |
| Stored COGS for recovered cohort | 415,160 VND | 414,227 VND | -933 VND |
| Recovered-cohort drift | -933 VND | 0 VND | +933 VND |
| Gross profit for affected period | baseline | baseline +933 VND | +933 VND |

The remaining 130 locked rows consist of the intentionally non-recovered
`BACKDATED_LEDGER` and `UNRESOLVED_WRITE_TIME_PROVENANCE` cohorts. Their stored
values were not changed.

## Phase summary

| Phase | Result | Evidence |
|---|---|---|
| A - migration and locks | Migration 0012 deployed; 170 locks inserted and RLS verified | `da525d3` |
| B - snapshot | Targeted snapshot captured and manifest verified | `02bfc3c` |
| C - dry-run and apply | Exact 40-line payload previewed, then atomically applied | `02bfc3c` and production RPC output |
| D - verification | Six cohort-isolated checks passed | Verification artifact below |
| E - documentation | Baseline audit, result, tracking, and roadmap updated | Task E3 closing commit |

Earlier recovery-gate preparation is in commit `996b09d`.

## Recovery verification

The recovery cohort is defined by the explicit 40 approved line IDs, not by
the sign of `audit_baseline_locks.delta_vnd`. The fixed baseline contains 65
negative-delta locks: 40 recovered lines and 25 intentionally untouched lines.

| Check | Result | Gate |
|---|---:|---|
| 1. Recovered lines not equal to reviewed expected value | 0 | Pass |
| 2. Other locked lines changed from original stored value | 0 of 130 | Pass |
| 3. Recovery audit rows for the run ID | 40 | Pass |
| 4. Normal no-op update of a locked line | Blocked by `audit-baseline locked` trigger | Pass |
| 5. Cohort drift effect | -933 VND to 0 VND; +933 VND effect | Pass |
| 6. Live mismatch population isolated from locked cohort | 130 locked, 224 outside | Pass |

Five sampled recovered lines matched their reviewed expected values, and five
sampled non-recovered lines matched their original stored values. The trigger
probe was rejected, so no verification row was changed.

Verification artifact:
`docs/audits/2026-07-13-task-3-recovery-verification.json`.

Snapshot manifest SHA-256:
`a6f2ec13b3d1cd0238c3d12549baab929e5d14a46cb926de8f576fc183d74cf0`.

## Outside-cohort discovery

The current live replay reports 354 mismatches and -141,297 VND total delta.
This is not the fixed 170-line baseline:

| Population | Lines |
|---|---:|
| Locked baseline mismatches remaining after E3 | 130 |
| Mismatches outside the locked cohort | 224 |
| Outside cohort dated after 2026-07-02 | 71 |
| Outside cohort dated on or before 2026-07-02 | 153 |

The outside-cohort date range is 2026-04-20 through 2026-07-14. Task 3.4
must investigate these 224 lines; they cannot be described as only new July
3-14 orders. Task 3.5 must make the baseline audit cohort-aware and prevent it
from overwriting the fixed source artifact.

## Future rollback procedure

No rollback is currently required. If a future accounting decision requires
undoing E3, do not perform ad hoc row updates and do not assume a generic JSON
restore script exists; `scripts/restore-prod-from-json.ts` is not present in
this repository.

Use this reviewed boundary:

1. Re-verify the targeted snapshot
   `recovery-snapshots/task-3-recovery-2026-07-13-081930193Z/` and its manifest.
2. Build a dedicated atomic rollback RPC or reviewed transaction for this run.
3. Acquire the same run-level and per-line advisory locks used by the recovery.
4. Require all 40 live values to equal `data_recovery_changes.new_value` before
   changing any row; abort the whole transaction on any mismatch.
5. Set `app.mac_drift_recovery=on` transaction-locally, restore each value from
   `data_recovery_changes.old_value`, and set `rolled_back_at = now()` for the
   same 40 audit rows in that transaction.
6. Re-run the snapshot, line-value, trigger, cohort-drift, Vitest, and TypeScript
   gates. The fixed cohort should return to its pre-E3 stored state.

This rollback requires separate production-write approval.
