# MAC Drift Baseline Audit

Date: 2026-07-09
Status: Revised baseline, read-only diagnosis complete

## Summary

The live MAC drift baseline is now 170 `Order_Lines_V2` rows, not the earlier
164-row baseline documented on 2026-07-02.

Current read-only audit:

- Eligible completed orders: 1,329.
- Eligible order lines: 1,896.
- Mismatched order lines: 170.
- Stored COGS: 19,067,558 VND.
- Expected MAC COGS: 19,187,340 VND.
- Audit total delta: +119,782 VND.
- Sum of mismatched line deltas: +119,783 VND. The 1 VND difference is caused
  by sub-threshold line deltas included in the total audit but not in the
  mismatch list.

Artifacts:

- Line baseline: `docs/audits/2026-07-09-mac-drift-baseline-lines.json`.
- Recovery plan dry-run: `docs/audits/2026-07-09-mac-drift-recovery-plan.json`.
- Read-only audit command:
  `node_modules\.bin\vite-node.cmd scripts\audit-mac-drift-baseline.ts`.

No database rows were written during this audit.

## Revised +6 investigation

The previous documented baseline was 164 lines / +119,036 VND on 2026-07-02.
The current live audit is 170 lines / +119,782 VND.

The net movement is:

- Line count: +6.
- Audit total delta: +746 VND.

The movement is not a pure six-line append. Current data contains 8
post-2026-07-02 mismatch lines totaling +713 VND, all from non-migrated live
POS orders for `PROD-028` with `BTP_SHORTFALL` classification:

| Order | Line | Delta |
|---|---|---:|
| PHD000893 | `ol-35ef2d85-9c6b-42e6-a94b-ca822e384423` | +199 |
| PHD000883 | `ol-08bbc0ba-6f00-4aa4-a71c-cec7e96ff08e` | +79 |
| PHD000887 | `ol-db72a765-56c5-4b29-884c-a522cb51eabe` | +79 |
| PHD000890 | `ol-769255d6-4063-46e8-bdd4-8b45108f57d0` | +79 |
| PHD000896 | `ol-11dbf85d-80dc-4ca3-80c0-f54f64563dfe` | +79 |
| PHD000897 | `ol-91b3ca39-dad8-4a2d-b387-f0ad7e6407f3` | +79 |
| PHD000899 | `ol-be44f399-b097-4ccb-a42c-d69e6ef22637` | +79 |
| PHD000894 | `ol-42cc0fcb-2830-4a64-9207-9fac5f763abf` | +40 |

The arithmetic implies:

- +8 new post-baseline mismatched lines.
- -2 net old mismatched lines relative to the 2026-07-02 count.
- +713 VND from post-baseline lines.
- approximately +33 VND net movement inside the pre-2026-07-03 population.

There is no captured 164-line ID list in the repo, so an exact set-diff against
the old baseline cannot be proven. The observable cause of the net +6 is that
new live POS lines continued to hit the same BTP shortfall drift pattern after
the 2026-07-02 audit. It is not explained by migrated-order markers:

- Lines correlated with `Order_Events.event_type = MIGRATED` or
  `Orders_V2.migration_notes`: 2.
- Lines without migrated-order markers: 168.

The two migrated-marker lines are small negative deltas:

| Order | Line | Class | Product | Delta |
|---|---|---|---|---:|
| UCK000369 | `ol-b4d1aafb-1bb4-4a61-b57b-fe6909816930` | MAC_REPRICE | PROD-018 | -46 |
| UCK000364 | `ol-463bfc8b-f2b2-45c9-ba48-9312b6374d7c` | BTP_SHORTFALL | PROD-014 | -8 |

## Root cause hypothesis

The affected value is `Order_Lines_V2.cost_at_sale`. This is order-line COGS
drift, not stock-ledger quantity drift.

The dominant pattern is `BTP_SHORTFALL`: the current production MAC replay
splits semi-product shortfall into base-ingredient consumption and prices the
base ingredients with current MAC fallback coverage. Historical backfill/import
paths stored `cost_at_sale` using a different effective MAC computation. That
left stored COGS lower than the current production replay for most affected
lines.

The smaller `MAC_REPRICE` group is consistent with input-cost/MAC timeline
changes after historical order lines were written.

## Sample affected lines

| Order | Line | Class | Product | Qty | Stored | Expected | Delta |
|---|---|---|---|---:|---:|---:|---:|
| UCK000277 | `ol-2050e85f-56b3-4182-ba4e-a896b60ef966` | BTP_SHORTFALL | PROD-023 | 3 | 19,265 | 38,887 | +19,622 |
| UCK000282 | `ol-cbece64b-8040-41ec-8be8-5706fef20d54` | BTP_SHORTFALL | PROD-023 | 1 | 6,422 | 12,962 | +6,540 |
| UCK000277 | `ol-3f8e8167-c725-4682-a052-24320785ff1e` | BTP_SHORTFALL | PROD-022 | 2 | 12,843 | 19,290 | +6,447 |
| UCK000288 | `ol-78d9a454-fb4a-4cea-9243-9dfc8c7bc7b5` | BTP_SHORTFALL | PROD-022 | 2 | 12,843 | 19,290 | +6,447 |
| UCK000278 | `ol-9b754ba8-dfe3-4fe5-acbe-4869acaff1cf` | BTP_SHORTFALL | PROD-023 | 1 | 6,422 | 10,669 | +4,247 |
| UCK000285 | `ol-9fc9f4f1-6306-4774-a7ec-74bccd14eac5` | BTP_SHORTFALL | PROD-023 | 1 | 6,422 | 10,669 | +4,247 |
| UCK000286 | `ol-b0dd7440-c073-42ea-9bd587a6a983` | BTP_SHORTFALL | PROD-023 | 1 | 6,422 | 10,669 | +4,247 |
| UCK000276 | `ol-0bcf1489-3321-431a-9796-e42ab394f80f` | BTP_SHORTFALL | PROD-025 | 1 | 1,471 | 5,220 | +3,749 |
| UCK000275 | `ol-45d70f7a-4370-44f5-91c1-0731193343af` | BTP_SHORTFALL | PROD-011 | 1 | 784 | 4,136 | +3,352 |
| UCK000280 | `ol-1ed03b43-482c-44f2-85a1-a3b9214776d3` | BTP_SHORTFALL | PROD-005 | 1 | 5,246 | 8,473 | +3,227 |

## Aggregate impact

By classification:

| Classification | Lines | Delta |
|---|---:|---:|
| BTP_SHORTFALL | 132 | +110,935 |
| MAC_REPRICE | 38 | +8,848 |

By order date:

| Date | Lines | Delta |
|---|---:|---:|
| 2026-06-25 | 2 | +706 |
| 2026-06-26 | 25 | +86,232 |
| 2026-06-27 | 32 | +13,495 |
| 2026-06-28 | 27 | +11,135 |
| 2026-06-29 | 20 | +8,818 |
| 2026-06-30 | 32 | -805 |
| 2026-07-01 | 19 | -434 |
| 2026-07-02 | 5 | -77 |
| 2026-07-05 | 1 | +79 |
| 2026-07-06 | 7 | +634 |

Top products by absolute delta:

| Product | Lines | Delta |
|---|---:|---:|
| PROD-023 | 6 | +39,509 |
| PROD-022 | 5 | +19,946 |
| PROD-005 | 10 | +11,717 |
| PROD-003 | 10 | +6,676 |
| PROD-006 | 10 | +6,117 |
| PROD-024 | 8 | +5,043 |
| PROD-025 | 8 | +4,651 |
| PROD-015 | 11 | +4,498 |
| PROD-002 | 7 | +3,640 |
| PROD-011 | 1 | +3,352 |
| PROD-019 | 13 | +3,291 |
| PROD-018 | 15 | +2,629 |

## Lock design

The lock target must be `order_line_id`, not `ledger_id`, because the baseline
is stored COGS drift on `order_lines_v2.cost_at_sale`.

Migration `supabase/migrations/0012_mac_drift_baseline_locks.sql` creates:

- `public.audit_baseline_locks(order_line_id primary key, locked_at, locked_by,
  reason, source_hash, stored_cost_at_sale, expected_cost_at_sale, delta_vnd)`.
- RLS enabled; `public`, `anon`, and `authenticated` revoked.
- `service_role` can `select` and `insert`.
- A trigger blocking update/delete of locked `order_lines_v2` rows.
- `apply_mac_drift_recovery(...)`, an atomic RPC that can bypass the trigger
  only inside the reviewed recovery transaction, requires each changed line to
  have a baseline lock, and logs changes to `data_recovery_changes`.

This migration is local only at the time of this document. It was not deployed,
and no locks were inserted.

## Recovery options

### Option A: Leave as audit baseline and lock rows

Current user decision.

- Risk: low operational risk because COGS rows are not changed.
- Trade-off: stored affected-period COGS remains approximately 119,782 VND
  lower than current MAC replay; gross profit is correspondingly higher if
  current MAC replay is used as the benchmark.
- Implementation: deploy migration 0012, insert the 170 `order_line_id` rows
  from the line artifact into `audit_baseline_locks`, and keep the JSON artifact
  as the reviewed source list.

### Option B: Recompute affected `cost_at_sale`

- Risk: medium because it modifies historical COGS.
- Benefit: P&L aligns with current MAC engine.
- Guardrail: use `scripts/recover-mac-drift.ts --apply` only after snapshot,
  migration 0012 deploy, lock population, and review of the dry-run plan hash.

### Option C: Add compensating adjustment entries

- Risk: lower than editing originals, but it introduces a reporting concept
  that current P&L does not consume automatically.
- Benefit: preserves original order lines.
- Trade-off: requires report logic to include the adjustment entries or a
  separate manual reconciliation process.

## Verification performed

- `node_modules\.bin\vite-node.cmd scripts\audit-mac-drift-baseline.ts`:
  read-only audit produced 170 lines and wrote local JSON artifact.
- `node_modules\.bin\vite-node.cmd scripts\recover-mac-drift.ts`: dry-run
  produced a 170-change recovery plan and did not write database rows.
- Targeted Vitest for baseline helper and migration SQL shape passed.

## Post-E3 recovery (2026-07-13)

Task E3 selectively recovered the 40 lines classified as
`PURCHASE_COST_RECOVERY`. The fixed 170-line baseline remains the reviewed
source cohort; its JSON artifact has SHA-256
`cd0a2b13d6e52cf7cd53dd8223b805686c7fa579ef76a245a588d484fe630dc3`.

Production recovery run
`task-3-recovery-2026-07-13-081930193Z` atomically:

- updated the exact 40 approved `order_lines_v2.cost_at_sale` values;
- reduced stored COGS for those lines from 415,160 VND to 414,227 VND;
- produced a -933 VND COGS correction and a corresponding +933 VND gross
  profit effect for the affected period;
- inserted 40 matching `data_recovery_changes` audit rows; and
- left the other 130 locked baseline lines unchanged.

Cohort-isolated verification passed all six gates: zero recovered-value
mismatches, zero non-recovered changes, 40 recovery audit rows, the normal
lock trigger still blocked mutation, snapshot drift moved from -933 VND to
0 VND, and the current live mismatch population was separated from the fixed
baseline cohort. See
`docs/audits/2026-07-13-task-3-recovery-result.md` and
`docs/audits/2026-07-13-task-3-recovery-verification.json`.

The recovery was prepared in commits `996b09d`, `da525d3`, and `02bfc3c`;
the final verification and documentation are in the Task E3 closing commit.

## Cohort-aware operator audit (Task 3.5, 2026-07-16)

`scripts/audit-mac-drift-baseline.ts` now treats this document and
`2026-07-09-mac-drift-baseline-lines.json` as frozen evidence. Before reading
live data it verifies the approved artifact SHA-256, and its output is written
to `docs/audits/<YYYY-MM-DD>-mac-drift-baseline-audit.json`. A same-day rerun
replaces only that day's operational report; it never rewrites the frozen
170-line source.

Each live mismatch is assigned to exactly one operator bucket:

- `LOCKED_MATCHED`: stored and replay values still equal their locked values.
- `LOCKED_VIOLATION`: at least one locked value changed. This splits into
  `LOCKED_VIOLATION_STORED`, a critical stored-COGS integrity incident, and
  `LOCKED_VIOLATION_REPLAY`, an informational replay shift with stored COGS
  intact.
- `KNOWN_NOT_LOCKED`: the line appears in a reviewed Task 3.4, 3.6, or 3.8
  artifact but has no database lock.
- `NEW_INVESTIGATION_NEEDED`: the line has neither a lock nor reviewed artifact
  evidence.

The first cohort-aware run found 396 live mismatches: 380 `LOCKED_MATCHED`, 16
`LOCKED_VIOLATION_REPLAY`, zero stored violations, zero known-but-unlocked
lines, and zero new investigation lines. All 16 replay shifts retain the exact
locked stored COGS; they are E3-baseline lines exhibiting the known BTP recipe
replay pattern. Task 3.10 owns their policy decision and any future re-locking.

### Audit-tool follow-up

The former script behavior recomputed the entire live population and rewrote
the fixed baseline artifact. Task 3.5 replaced that behavior with the
cohort-aware, frozen-artifact-safe workflow above. Task 3.4 remains the source
investigation for the original 224 outside-cohort mismatches.
