# COGS-5 Pipeline Root-Cause Review

Date: 2026-07-24

Reviewer: Codex

Mode: read-only production audit; no data writes

## Outcome

The open COGS-5 premise was incorrect: the 41 lines described as
"touched once but not corrected by a second applicable backdated event" were
never written by the backdated-event pipeline.

All 41 prior writes came from the single accepted historical-gap recovery run:

`task-3.9-historical-gap-recovery-2026-07-21`

That cohort deliberately preserved reviewed values behind
`audit_baseline_locks`. A naive full-history recompute was expected to disagree
with those values. Therefore the 41-line disagreement did not demonstrate an
event-ordering or `findAffectedLines` coverage defect.

## Evidence

The new read-only audit `scripts/audit-cogs5-pipeline-premise.ts` joined the
85 COGS-5 synthetic events to all paginated `data_recovery_changes`, then
classified only writes made before each line's COGS-5 correction.

Live result:

- COGS-5 events: 85
- COGS-5 target lines: 112
- target lines with any earlier write: 41
- earlier writes from Task 3.9 historical-gap recovery: 41
- earlier writes backed by a durable `backdated_ledger_events` row: 0
- other earlier-write sources: 0

This independently reproduces the exact 41-line count while disproving the
claimed second-event mechanism.

## Retroactive correction review

The original `apply-cogs5-full-cost-correction.ts` correctly limited its direct
write payloads to the 112 computed line IDs, but it treated the naive recompute
as authoritative for locked lines. That was unsafe. The subsequent recovery
was the correct response:

- `revert-cogs5-lock-violations.ts` restored the 96 locked lines and retained
  only the 16 unlocked corrections.
- Migration `0030_harden_backdated_event_recovery_against_locks.sql` rejects
  locked line IDs in both ledger-event and recipe-event recovery RPCs before
  enabling the recovery bypass setting.
- Existing migration tests verify both RPC guards, guard ordering,
  idempotency invariants, search path, and service-role-only execution.

## Actual pipeline defect found and fixed

Both the scheduled route and `apply-pending-backdated-events.ts` left a
zero-change event in `PENDING` forever. This commonly occurs when an earlier
event's full sale-time replay already incorporated a later receipt. It does not
leave cost partially corrected, but it causes the same event to be retried on
every sweep and makes lifecycle history misleading.

The scheduled route now marks zero-change ledger and recipe events as
`RECOMPUTED` with a zero change count. The CLI apply path now also settles
zero-change events. Regression coverage includes a two-event batch where the
first event applies the cost change and the second event is cleanly settled as
no-change.

## Commands

```text
node_modules\.bin\vite-node.cmd scripts\audit-cogs5-pipeline-premise.ts
node_modules\.bin\vitest.cmd run app\api\cron\apply-backdated-corrections\route.test.ts lib\cogs5-pipeline-audit.test.ts lib\backdated-event-recovery-lock-guard-migration.test.ts
node_modules\.bin\tsc.cmd --noEmit
```

No `--apply` command was run and no production row was changed during this
review.
