# Open Items

The single list of what is not finished. Kept short on purpose — one line of
what, one of why it is still open. Detail lives in the linked plan or spec.

Updated 2026-07-31. Update it in the same commit that changes an item's state;
if it only exists in a chat message, it does not exist.

**Why this file exists:** the owner asked twice what remained, and both times the
answer had to be reconstructed by counting, because the plan files' checkboxes
were never ticked and the roadmap only tracks closed phases. See "Tracking debt"
at the bottom.

---

## Blocking nothing, but the numbers depend on them

| # | Item | Why open |
|---|---|---|
| 1 | **Late-entered recipe: the INSERT path has never fired** | Editing an existing recipe's dates is proven live. Creating a *new* recipe with a back-dated `start_date` is not: `RC-032` ("Khoai luộc", created 2026-07-30 14:33, `start_date` 2026-06-01, 59 days back) produced no `backdated_recipe_events` row. Probably because migration `0043` landed after it — never confirmed. This is the path the owner uses most. |
| 2 | **1,389 stale detection rows mask the queue** | `backdated_ledger_events` holds 1,389 `PENDING` rows whose `source_table` is `FULLHISTORY_REBUILD_2026-07-24` — spurious detections the 24/07 rebuild triggered on itself, before migration `0042` suppressed that. Harmless, but while they sit there nobody can see whether a *real* event is stuck. |

## Backup

| # | Item | Why open |
|---|---|---|
| 3 | **The daily bundle will exceed 50 MB again** | 39.6 MB now, 10.4 MB of headroom, and one full rebuild costs ~14 MB. Migration `0045`'s 30-day retention deletes nothing until ~2026-08-23. Plan: `docs/superpowers/plans/2026-07-31-split-recovery-log-from-backup.md`. |
| 4 | gzip the bundle | Deferred. Rests on an unverified assumption that Apps Script's 50 MB limit applies to compressed bytes. Test before relying on it. |

## Logging hygiene (analysis done 2026-07-31, nothing implemented)

Measured: `data_recovery_changes` is **60.4%** of all stored data (15.88 MB,
46k rows). The business logs are tiny — `order_events` is 3.8%, and only **28 of
its 1,844 rows** carry information not derivable from the order itself.

| # | Item | Why open |
|---|---|---|
| 5 | Stop writing `CREATED` order events | 1,061 rows duplicating what `orders_v2` already records. |
| 6 | Delete 755 `MIGRATED` order events | One-time V1→V2 artifact, spent. |
| 7 | **Keep** `VOIDED` (15) / `EDITED` (13) / `purchase_order_edits` (2) | Not a task — a decision recorded so nobody "optimises" them away. `VOIDED` rows carry `net_total_before` and a typed reason: the only record of money leaving the books, unreconstructable afterwards. `purchase_order_edits` records subtotal and line-count before/after, which is exactly what would have caught PO-037. |

**Rule for future features:** log it only if it (a) changes money or stock **and**
(b) is not derivable from the record itself. Void, edit, discount, price change,
PO edit, stocktake adjustment → yes. Create, view, search, login → no.

## Costs that never reach a report

| # | Item | Why open |
|---|---|---|
| 8 | **Operating-expense entry screen does not exist** | The owner chose to treat ice, limes, kumquats and sweet potato as daily expenses rather than tracked stock. With nowhere to record them, that cost currently vanishes from every report, and any drink using them shows a higher margin than it earns. |
| 9 | Khoai lang wired half-way | Owner parked it deliberately. See spec section 7a — `RC-032` exists, but nothing consumes `BTP-014`, `REC-069` is empty, and `NNL-012` is still non-inventory. Do not read `RC-032` as evidence it is costed. |
| 10 | Sữa đặc: no purchase recorded since 2026-05-16 | Either never entered or entered against a different purchased item. Spec section 7b. |

## Phase 7 and later

| # | Item | Why open |
|---|---|---|
| 11 | 17 forms, 11 competing input styles | The owner's own stated priority; nothing built yet. |
| 12 | Backfill `start_date` on 129 recipes | Safe only if `selectEffectiveRecipe` returns an identical result for all order lines afterwards. |
| 13 | **Load speed has never been measured** | One of the owner's four original priorities. No baseline exists, so no target can be set. Measure before planning any fix. |
| 14 | Retire `data_migration_runs`, dead config rows (`BTP-004`) | Retire by marking inactive — never delete master data (`docs/COLLABORATION.md`). |
| 15 | Physical stocktake | Owner moved it behind Phase 7, to be the last act before expansion. |
| 16 | Shift and cash reconciliation (`FC-3`) | Owner deferred: no staff yet. |

## Tracking debt

| # | Item | Why open |
|---|---|---|
| 17 | **285 unticked checkboxes across 12 plan files**, most describing finished work | The plans cannot be read to find what is left — the one job they had between sessions. Fix forward: tick as you go, and add a status banner to closed plans. Do not retroactively tick boxes nobody verified. |
