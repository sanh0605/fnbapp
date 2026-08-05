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
| 2b | **132 more, same cause, now on the recipe table** | The 31/07 `start_date` backfill issued 124 `UPDATE`s on `recipes`, and `0043`'s trigger fires on update — so it flagged each one as operator backdating. Owner chose (31/07) to let the 03:00 cron run and compare rather than clear them first. Full dry run of all 132 predicts 115 self-clear, 15 stay `PENDING` as false alerts, 2 auto-rewrite 22 order lines (~1e-6 VND each). Capture: `docs/audits/2026-07-31-backdated-recipe-events-before-cron.json`; analysis: `docs/audits/2026-07-31-start-date-backfill-trigger-fallout.md`. **Owner decided 01/08 not to diff the result** — the predicted exposure was negligible and the capture stays on file if it is ever wanted. **VERIFIED 02/08: none of that happened.** Two nights on, the table still reads 132 `PENDING`, `is_anomalous = 0` — not one event self-cleared, was flagged, or auto-applied. The nightly sweep has not processed anything. Most likely cause is item 19 (`CRON_SECRET` never set), though a 401 cannot be distinguished from a never-invoked schedule without Vercel access. **What remains open:** the 132 rows sit untouched and mask real events, same as item 2 — and the auto-rewrite of 22 order lines predicted on 31/07 never occurred, so no historical cost was silently changed. |

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
| 12 | ~~Backfill `start_date` on 129 recipes~~ **DONE 31/07** | 124 rows backfilled (`7364ffe`), `NOT NULL` added (`0048`), read-time fallback removed (`0049`, `acf2a68`). Equivalence proven across 4,820 replayed selections. Side effect is item 2b. |
| 12b | **Task 5 never ran, and the path it audits now has live data** | Task 5 measures whether `findLatestActiveRecipe` (sorts by `created_at`, ignores effectiveness) and the `end_date` close-out handle future-dated recipes. `RC-035` and `RC-038` now carry `start_date` 2026-08-31. Plan: same file, Task 5. |
| 13 | **Load speed has never been measured** | One of the owner's four original priorities. No baseline exists, so no target can be set. Measure before planning any fix. |
| 14 | Retire `data_migration_runs`, dead config rows (`BTP-004`) | Retire by marking inactive — never delete master data. |
| 14b | Test semi-products sitting in the live catalogue | "Test lần 2" (`BTP-016`) and "Test Task6 Step8" (`BTP-017`) are `ACTIVE` in real master data, from the 31/07 live verification steps, along with recipes `RC-033`-`RC-040`. "Test" (`BTP-015`) is `DELETED` but its recipe `RC-035` is still `ACTIVE` — the deleted-semi-product shape the start_date plan warns about. Nothing broken (no stock, no orders); retire by marking inactive, ask the owner first. |
| 15 | Physical stocktake | Owner moved it behind Phase 7, to be the last act before expansion. |
| 16 | Shift and cash reconciliation (`FC-3`) | Owner deferred: no staff yet. |

## Chua xac minh duoc tu ben trong

| # | Item | Why open |
|---|---|---|
| 25 | **The bulk-data hook has never been seen to fire** | `.claude/settings.json` gained a `PreToolUse` hook on 2026-08-02 (Task 4). Its command is proven correct by pipe-test, its JSON parses, and both files are tracked by git. What is *not* established is that the harness runs it: a live test from the coordinator's session produced no injected reminder, which does not distinguish a misconfigured hook from a session that cached settings at start. **Owner action:** `/hooks` is unavailable over Remote Control (tried 2026-08-02), so the remaining route is simply a session started after 2026-08-02 — settings load at session start regardless of how the session is opened. In that session, run any command containing `--apply` and say whether the reminder appears. Same for whether `fnbapp-bulk-data-change` shows in the skills listing. |

## Chuong trinh quy tac va cau truc

| # | Item | Why open |
|---|---|---|
| 26 | **Phase 2 — business rules as tests** | Deferred 2026-08-02. It would encode a COGS calculation the owner is about to replace. The display-rounding half does not depend on the calculation and could be written earlier if wanted. Spec: `docs/superpowers/specs/2026-08-01-working-rules-and-repo-structure-design.md`. |
| 27 | **Phase 3 — repository restructure by business domain** | Deferred 2026-08-02, owner sequenced the COGS calculation change first because it lands on `mac-cogs` and `inventory-consumption`, two of the three domain hubs. Dependency map already measured and kept: `docs/audits/2026-08-02-lib-dependency-map.md` — 78 modules, only 3 unreferenced, and the tangle is infrastructure rather than cross-domain, so the split is feasible. Resume after the calculation change lands. |
| 28 | **Phase 4 — UI/UX rules** | Deferred by owner decision until after the restructure. 28 pages, 15+ inconsistent empty-state patterns measured 2026-07-06. |
| 33 | **The low-stock warning loses its input permanently, not just its history** | `lib/reorder-suggestion.ts` derives consumption speed from `SALES_CONSUME` and `PRODUCTION_CONSUME`, and feeds `lowStockItems` on the daily dashboard (`app/admin/reports/daily/actions.ts:80`). After Plan B Task 3 nothing writes those row types again, so the feature does not break — it reports "not enough data" forever, silently. It also calls `buildInventoryBalances` from `lib/inventory-consumption.ts`, the file Plan C Task 6 says it removes from the running path, so the plan contradicted itself until the 2026-08-05 challenge round. Consumption speed is still derivable from `stock_issues`, but only as coarsely as counts are taken. **Owner decided 2026-08-05: switch it off with a Vietnamese line on the screen explaining that a count is needed, decide the rebuild later.** The deciding number: `MIN_CONSUMPTION_EVENTS = 3` over a 14-day window (`lib/reorder-suggestion.ts:95-106`), so a weekly count yields two events and every item reports "not enough data" regardless. **Still open:** whether to rebuild once counting frequency is known, and whether to retune the threshold. |
| 32 | **No rule yet for a count that exceeds theoretical stock but not total purchases** | Reachable from the **second** stocktake onward, never the first: with no issues recorded, theoretical equals total purchased and the case collapses into `BR-INV-005`. It means an earlier count recorded more as issued than actually left, so cost for that earlier period is overstated and the shelf sits permanently above the books. Plan B Task 3 refuses the line rather than ignoring it, because recording nothing would make the discrepancy recur at every future count with no trace, and `stock_issues` forbids a negative `base_quantity` by construction so no reversal is expressible today. **Owner decision needed before the second count:** whether an over-recorded issue can be reversed, and if so at what cost. |
| 31 | **The financial report needs redesigning, and it is not a P&L today** | Owner decision 2026-08-04: discuss after the COGS change lands. Two findings recorded so they are not rediscovered. First, `app/admin/reports/pnl/page.tsx` is titled "Báo cáo Lãi Lỗ (P&L)" but stops at gross profit — there is **no operating-expense table anywhere in the schema**, so rent, wages, utilities and packaging have never been subtracted. July 2026 reads "lãi 11.412.736đ" before any of them. Second, issue-based costing removes the per-drink cost breakdown outright and forces the ingredient-consumption table to be rebuilt around purchased items; Plan C Task 2 carries that forced part. Expense tracking is a separate subsystem and needs its own spec. **Owner decided 2026-08-05 to delete the existing P&L screen rather than maintain it until then** (Plan C Task 2b): revenue lives on `app/admin/reports/sales/page.tsx` independently, and gross profit currently equals revenue exactly because cost is zero, so the page adds no information. `getPnLDataV2` is deliberately kept with no caller — it is the revenue gate for the remaining deletions and the starting point for the rebuild. |

## Tracking debt

| # | Item | Why open |
|---|---|---|
| 17 | **285 unticked checkboxes across 12 plan files**, most describing finished work | The plans cannot be read to find what is left — the one job they had between sessions. Fix forward: tick as you go, and add a status banner to closed plans. Do not retroactively tick boxes nobody verified. |
| 24 | **`scripts/check-rules-current.ts` covers 3 fixed documents plus `docs/operations/*.md`, not every living document** | Covered as of 2026-08-02: `CLAUDE.md`, `docs/BUSINESS-RULES.md`, `docs/OPEN-ITEMS.md`, and every `.md` under `docs/operations/` (read from disk, so new runbooks are automatic). **Not covered**, so a dead reference in any of these can go unnoticed: `README.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `docs/TESTING.md`, `docs/FEATURE-CATALOG.md`, `docs/ACCESS-MODEL.md`, `docs/FILE-ORGANIZATION.md`, `docs/domain-dictionary.md`. Widening needs a cleanup pass first — several already carry dead links, and the gate would fail on day one. `DEVELOPMENT-TRACKING.md` and the closed `docs/COMPLETED.md` stay out permanently by design; both are chronicles, not living claims about the present. |

## Migrated from ROADMAP.md, now deleted (Task 3b, 2026-08-01)

The old roadmap file is gone as of this task — see `DEVELOPMENT-TRACKING.md`
for the closed-row count. These 6 rows were its only genuinely open items (`[ ]`
or `[~X]`, not folded into a later closed task).

| # | Item | Why open |
|---|---|---|
| 18 | **`INV-COUNT-1` — periodic stocktake: built and live, never once used** | **Corrected 2026-08-02 by checking production; the previous text was wrong on all three counts.** Migrations `0036` and `0037` are both applied (remote confirms `0037`), `apply_stocktake_session_atomic` exists and writes `STOCK_ADJUST` rows, and the UI is complete (`app/admin/inventory/stocktake/**`, `lib/stocktake-transaction.ts`). What is true is that **`stocktake_sessions` holds 0 rows** — the feature has never been exercised. Not stranded work; unproven work. This became load-bearing on 2026-08-02: the owner's new COGS model values goods *issued* from stock, and periodic counting is one of the two ways he records an issue. The stale claim came from copying the old roadmap's row verbatim during Task 3b without verifying it. |
| 19 | **`COGS-1-FOLLOWUP` — `CRON_SECRET` missing in Vercel** | `app/api/cron/apply-backdated-corrections/route.ts:38` returns 401 and does nothing without it — owner action in Vercel settings, cannot be set from here. **Tension with item 2b, found while migrating this row**: item 2b assumes "the false alerts still sitting `PENDING` are re-dry-run by the cron every night." Read the route directly — without `CRON_SECRET` set, every invocation 401s before touching any event, so if it was never set, the cron has never actually run and item 2b's 115-of-132-predicted-to-self-clear estimate may not be happening at all. **Resolved 02/08 by reading production:** the contradiction is real and this item is the cause. `backdated_recipe_events` still shows 132 `PENDING` / `is_anomalous = 0` after two scheduled runs, so the sweep has never processed an event. **Consequence beyond item 2b:** the automatic backdated-cost correction that `COGS-1` was closed on — detection plus correction — has only ever done the detection half. Rows land in the queue; nothing drains it. **Queue measured 02/08:** 1,390 PENDING ledger events + 132 recipe events = 1,522 total. 1,358 of the ledger rows are the known-spurious `FULLHISTORY_REBUILD_2026-07-24` batch (item 2); the other 32 were dry-run individually and **every one produces a 0.00 VND delta** — they name `PO-037`, `PO-024` and `PO-057`, the exact purchase orders already corrected by hand during the Clean Rebuild Phases 4-6. **No money is sitting uncorrected.** Enabling the cron today would therefore change no cost, drain the queue, and raise roughly 34 false anomaly alerts on the dashboard. Caveat: measured with current local code against production data; the deployed app is behind, and the cron runs deployed code. The real gap is forward-looking — the next genuine operator backdating will not be corrected either. Recommended order: clear the stale queue first, then enable. **Deferred by the owner 02/08:** the inventory and COGS calculation method is about to change, so any correction computed against today's basis would be recomputed anyway. Revisit both this item and item 2b after that change lands — the queue is inert in the meantime (nothing drains it, nothing writes from it). |
| 20 | **`H1` — 40 local commits not pushed** | Push when the owner asks. Earlier tracking said "41+"; real count as of 2026-08-01 is **40** commits ahead of `origin/main`. |
| 21 | **`OPS-CONT-1` — operational continuity audit never run** | Single-owner dependency on the Vercel/Supabase/Google/GitHub accounts: recovery paths, 2FA, what happens if one is lost — never audited in any gate. Needs one session with the owner; output is a plain-Vietnamese runbook kept outside the repo, no secrets stored in it. |
| 22 | **`INFRA-UPGRADE-1` — Next.js 14→16, not started** | Carries `DEP-1`'s remaining `next` advisories, only fixed in `next@16`. Needs owner go-ahead. Full regression bar before merge: `tsc`, full suite, `next build`, P&L/MAC 0-delta audit, live smoke test. |
| 23 | **`V1` — first real operator backdate verify** | Waiting on the operator to backdate a purchase order in the real UI (weekly frequency, per the original user interview). Walk through: list → detail → approve → confirm drift = 0. |

## Future direction (owner priority, set 2026-07-18/19 — sequencing only)

Owner-stated long-term direction, in order. Nothing below starts until the
phase before it is done; do not begin implementation on any of these without
a fresh, explicit go-ahead even after the prior phase closes — this records
intent and order, not authorization to start.

1. **Finish current work** — the eight-gate audit. **Done**: all 8 gates closed
   (see `DEVELOPMENT-TRACKING.md`).
2. **Repository file/folder reorganization** — done 2026-07-20, but that pass
   was docs-and-scripts cleanup only (56 scripts deleted, docs consolidated).
   It is **not** the application-code restructure planned as phase 3 of the
   current working-rules program — that restructure has not started.
3. **Feature-completeness pass** — plan and close gaps so the single-shop
   system fully covers: inventory control, cash in/out control, sales
   reports, order reports, financial reports, and stock reports. Likely
   overlaps with `docs/FEATURE-CATALOG.md` findings and the deferred
   17-section F&B checklist (item 11 above) — reconcile rather than
   duplicate when this phase starts.
4. **UI/UX upgrade and frontend unification** — after feature completeness,
   not before; a consistent UI on top of incomplete features would need
   rework.
5. **Multi-branch management** — first of the two expansion features. Needs
   outlet entity, data isolation, outlet-scoped roles, consolidated
   reporting design (see `docs/FEATURE-CATALOG.md` `ORG-MULTI-OUTLET`).
6. **Full permissions and security hardening** — done once the system's
   shape through multi-branch is known, to avoid designing the permission
   model twice. Distinct from the eight closed security gates, which stay
   scoped to the current single-shop system; this phase is the full
   `docs/ACCESS-MODEL.md` Phase 3 verification plus whatever multi-branch
   roles add.
7. **Franchise management** — moved to last (owner decision 2026-07-19): not
   yet certain this gets built at all, so nothing before it should be
   designed around it, including the security-hardening phase. If approved
   later, its tenant-isolation needs get their own follow-up security
   review at that time.

## Out of scope (do not start without explicit approval)

- **Negative stock recovery** — needs a physical count decision from the
  owner. Figures here go stale fast; the current state is whatever the most
  recent rebuild audit says, not a number copied into this file. Most recent:
  `docs/audits/2026-07-29-phase4-rebuild-dryrun.json` /
  `-apply.json` (Phase 4 full-history rebuild) — as of that pass, the only
  remaining negative was Muối hồng, -14.39 g, root-caused to a purchase never
  entered under its correct item mapping.
- **Franchise system** — see "Future direction" above; comes after
  multi-branch, needs design + business rules (multi-tenant RLS, franchisee
  role, outlet management).
- **Multi-branch system** — see "Future direction" above; comes after the
  feature-completeness pass and UI/UX unification, needs design + business
  rules (outlet entity, data isolation, outlet-scoped roles).
- **Historical data rewrite** — any rewrite of pre-2026-07 data requires
  explicit owner approval, dry-run, atomic transaction, and verification.
- **Auth system overhaul** — the placeholder "admin" reviewer in the backdate
  UI is a known gap, but full auth is separate scope; see "Future direction"
  item 6, deliberately last.
- **17-section F&B capability checklist** — deferred from the pre-audit
  phase; needs owner per-item priority classification when scheduled.
