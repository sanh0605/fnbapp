# Lock-bypass forensic audit (Phase 0 of the full-history rebuild plan)

Date: 2026-07-22
Mode: read-only investigation, followed by 2 targeted reverts
Status: closed -- both violating populations reverted and reverified

## Background

Earlier the same day, `apply-cogs5-full-cost-correction.ts` (a full-system `cost_at_sale`
correction) silently overwrote 96 lines protected by `audit_baseline_locks`, because
`apply_backdated_event_recovery` unconditionally bypasses the lock trigger without validating
against it (unlike `apply_mac_drift_recovery`, which does). That incident was caught and reverted
the same session. This audit's purpose was to check whether the same vulnerability had been
exploited before, undetected -- per Phase 0 of the approved full-history rebuild plan.

## Method

`scripts/audit-lock-bypass-history.ts` joins `data_recovery_changes` (every write ever made
through `apply_backdated_event_recovery`, i.e. `run_id like 'backdated-%'`) against
`audit_baseline_locks` on `row_id = order_line_id`, filtering to `applied_at > locked_at`. Any
match is a write to a line after it was locked, made through the RPC path that never validates
against the lock -- exactly today's incident's shape.

## Finding: 127 prior violations, 2026-07-20 and 2026-07-21, all still live

319 total lock-bypass writes were found; 192 were today's already-known COGS-5 incident (96 wrong
+ 96 correcting revert, both via this same RPC path). The remaining **127 were genuinely prior,
undetected, and still holding the wrongly-overwritten value** (0 of 127 had self-corrected since).

Two documented cohorts, both violated:

- **`BTP_RECIPE_REPLAY_DRIFT` (52 lines, net delta -4,422 VND)**, applied 2026-07-20/21. The
  lock's own recorded reason states plainly: "temporal asymmetry, stored COGS correct at sale
  time, see policy doc 2026-07-16" -- i.e. the reviewed, correct value is `stored_cost_at_sale`;
  `expected_cost_at_sale` was a deliberately rejected alternative. These 52 lines were silently
  moved to the rejected value anyway.
- **`MAC drift baseline 2026-07-13` (75 lines, net delta +26,737 VND)**, applied 2026-07-21
  (mostly one large batch around 11:11 UTC, consistent with that night's migrated-orders MAC
  correction work). Per `docs/audits/2026-07-13-task-3-recovery-result.md` (Task 3 E3), this
  170-line lock cohort had an explicit, 6-gate-verified decision: exactly 40 named lines were
  approved for recovery (via `apply_mac_drift_recovery`, a different run-ID pattern not matched by
  this audit -- correctly excluded), leaving the remaining 130 lines **deliberately,
  verifiably untouched**. 75 of those 130 were silently moved to `expected_cost_at_sale` anyway by
  a later bypass write.

In both cases, `data_recovery_changes` shows these writes went through
`apply_backdated_event_recovery`, never the properly-guarded `apply_mac_drift_recovery` -- these
were not approved recoveries, they were the same unconditional-bypass bug as today's incident,
just two days earlier and never noticed until this audit.

## Remediation applied

`scripts/revert-prior-lock-violations-2026-07-20-21.ts`: for each of the 127 lines, reverted
`cost_at_sale` to `audit_baseline_locks.stored_cost_at_sale` (the documented-correct value for
both cohorts, per the policy references above -- not merely the immediately-prior recorded value,
since that is the better-evidenced target and self-corrects even if a line had more than one
bypass write). Dry-run matched the investigation exactly (127 lines, 117 orders, -22,315 VND net)
before `--apply`. Reverified: rerunning the same script now reports 0 remaining (all 127 already
at the documented-correct value); `audit-order-ledger.ts` quantity baseline unchanged at 203;
`audit-pnl-mac-consistency.ts` clean (0 VND internal delta); `tsc --noEmit` clean; full suite
617/617.

## Still open

Phase 0.5 of the approved rebuild plan (`C:\Users\Admin\.claude\plans\toasty-mapping-hollerith.md`)
closes the underlying vulnerability at the RPC level -- both `apply_backdated_event_recovery` and
`apply_backdated_recipe_event_recovery` need an explicit guard against `audit_baseline_locks`
before this class of incident can be considered fully prevented rather than just cleaned up after
the fact twice. Not yet implemented as of this document.
