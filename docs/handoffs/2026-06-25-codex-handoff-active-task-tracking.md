# Codex Handoff — 2026-06-25

## 2026-07-30 - OPEN, 0/4 tasks: clean rebuild program, Phase 5 (rebuild COGS)

**Implementer: Claude Sonnet 5.** Plan:
`docs/superpowers/plans/2026-07-30-phase5-cost-rebuild.md`. Owner chose to run
this immediately rather than wait for a trading day; the risk he accepted is
that the deployed build still has no real sales behind it, so an anomaly could
be ambiguous between the deploy, Phase 4, and Phase 5.

**Two things reverse what the spec assumed — read the plan's own section before
starting.**

1. **No baseline locks get released.** The spec called for releasing
   `audit_baseline_locks` as a recorded decision. The post-Phase-4 audit shows
   `cost_category_b_locked_current: 0` and `cost_category_c_locked_stale: 0` —
   all 1,066 mismatched lines are unlocked, so no lock is in the way. Releasing
   them would be a no-op carrying the exact risk that caused COGS-5. Do not call
   `remove_audit_baseline_lock`; do not use
   `scripts/remove-locks-and-recompute-cost.ts`.
2. **No new migration.** `apply_full_history_recovery` (migration 0031) was
   built for precisely this: Category A cost corrections, no stock rows, dry-run
   flag, idempotent per run-id, and an explicit per-line `not exists` guard
   against `audit_baseline_locks` so it cannot write a locked line even if the
   caller is wrong.

**Direction, and a retracted claim.** `delta = computed − stored`; net is
**−942,514 VND** over 1,066 lines (1,034 down, 32 up), so costs fall and
historical profit rises. An earlier note to the owner suggested this was the
same 942,000 VND as PO-024's tea purchase; that was retracted — correcting the
tea mapping *adds* cost and cannot produce a net reduction. Task 2 must
establish the real driver from data.

- `[ ]` Task 1: `lib/phase5-cost-scope.ts` + tests +
  `scripts/apply-phase5-cost-rebuild.ts`, batched by Saigon calendar month.
- `[ ]` Task 2: dry run, month-by-month owner summary, **owner gate**.
- `[ ]` Task 3: apply, then confirm stock and locks did not move.
- `[ ]` Task 4: verify `cost_mismatches: 0`, compare realised P&L against the
  approved forecast, report, update tracking.

**Carried over from Phase 4, still open:** the non-inventory real-sales proof
(0 orders since the `9ae2ce5` deploy, so the zero-row query proves nothing) and
Muối hồng −14.39 g (consumed by some recipe, never purchased under its own
mapping).

## 2026-07-30 - CLOSED, 6/6 tasks: clean rebuild program, Phase 4 (rebuild stock)

**Done 2026-07-30.** Applied: 1,743/1,743 orders, 0 failures. `rebuild_inventory_balances()` re-materialized 50 rows. Migration 0042 suppression confirmed (0 backdated events detected during the apply window). Verification: recorded equals recomputed for all 50 items, 0 mismatches. Only remaining negative: **Muối hồng, -14.39 g — not a rounding/measurement gap.** After the SPM-040 remap (below), Muối hồng's own receipt total is 0 g against 14.39 g of genuine recipe consumption: at least one recipe uses it, but it has never been purchased under its own correct mapping. **Named follow-up for the next phase**, not noise: find the consuming recipe(s) and confirm whether a purchase was simply never entered. Lá hồng trà resolved (+3,990.42 g) after the owner found and fixed the real root cause mid-review — purchased item SPM-040 was mapped to the wrong base ingredient (ING-014 Muối hồng instead of ING-021 Lá hồng trà), corrected at the source and re-saved through PO-024. Sữa đặc resolved (+41,269). Full writeup: `DEVELOPMENT-TRACKING.md` 2026-07-30 entry. Roadmap row: `REBUILD-PHASE4`. **Unblocks Phase 5 (cost rebuild)** per the plan's own gate — not started.

## 2026-07-29 (superseded by the entry above) - OPEN, 0/6 tasks: clean rebuild program, Phase 4 (rebuild stock)

**Implementer: Claude Sonnet 5.** Plan:
`docs/superpowers/plans/2026-07-29-phase4-stock-rebuild.md`. Spec: Phase 4 of
`docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`.

**State going in.** The 63-commit deploy is live (`6ebe8a0..9ae2ce5`, pushed
2026-07-29). The owner chose to skip the deploy plan's manual POS verification
(step 3) and one-day soak (step 4); Task 0 substitutes a read-only production
check that the non-inventory engine fix is actually running, which is the only
part Phase 4 genuinely depends on. Phase 3's restore drill passed. PO-037 has
been repaired by the owner.

**The finding that made this plan necessary — read Task 1 before anything else.**
`rebuild_stock_ledger_for_order` (migration 0034) does not set
`app.mac_drift_recovery`, unlike every other recovery RPC (migration 0030,
lines 129 and 294). The rebuild inserts `PRODUCTION_YIELD` rows with historical
`created_at`, so `detect_backdated_ledger_entry` (migration 0014, `after insert
... for each row`) will record a backdated event for each one. The
`/api/cron/apply-backdated-corrections` cron runs `0 20 * * *` UTC — 03:00
Vietnam time, hours after a night rebuild — and **auto-applies** any plan it
does not judge anomalous (`route.ts:158`). Because Phase 4 deliberately leaves
`cost_at_sale` for Phase 5, those events would each find a real delta (the
2026-07-29 reading already shows 1,275 mismatched lines, net -790,395 VND) and
write it overnight, unreviewed — bypassing both the owner's P&L gate and the
recorded `audit_baseline_locks` release. Migration 0042 closes this with the
one-line escape hatch migration 0014 already provides.

**The second trap, in Task 2.** `replayFullHistory` skips a line that throws and
still rebuilds its order from the remaining lines
(`lib/full-history-recompute.ts:284-289`). Contained under the old narrow scope;
at all-orders scope it deletes an order's full derived set and reinserts one
missing that line's consumption, silently and permanently. Any order with a
replay error is excluded outright and reported by name.

**Scope boundaries.** Stock rows only — every RPC call passes
`p_cost_changes: []`, `audit_baseline_locks` is not read, no money figure moves.
A new script (`scripts/apply-phase4-stock-rebuild.ts`);
`scripts/apply-full-history-stock-ledger-rebuild.ts` stays untouched because its
header records a different operation already run on 2026-07-24.

- `[x]` Task 0: confirm the deployed engine (read-only, no commit).
- `[x]` Task 1: migration 0042 suppressing backdated detection inside the
  rebuild RPC, plus the same fix folded into
  `docs/runbooks/restore-from-backup.md` — closing the runbook item raised
  2026-07-29 and never actioned.
- `[x]` Task 2: `lib/phase4-rebuild-scope.ts` + tests + the all-orders script.
- `[x]` Task 3: real backup, dry run, **owner review gate** (re-run twice; see
  the 2026-07-30 entry above for the SPM-040 mapping fix found mid-review).
- `[x]` Task 4: apply, then `rebuild_inventory_balances()`.
- `[x]` Task 5: verify with the corrected audit; answer Sữa đặc and
  Lá hồng trà explicitly.

**Two owner gates.** Task 3 Step 4 (approve the dry-run summary before `--apply`)
and the Phase 5 gate at the end. Do not cross either unprompted.

## 2026-07-29 - CLOSED, 5/5 tasks: clean rebuild program, Phase 2b (edit-trail safety and audit scope)

**Done 2026-07-29**, same day as Phase 1-2 above. Triggered by a real PO-037 edit the owner performed through the Phase 1-2 admin feature, which hit `Lỗi: findAll(purchase_order_edits): Could not find the table 'public.purchase_order_edits' in the schema cache` — the save had already committed, only the edit-trail insert failed against migration `0041` (written but not yet applied). Plan: `docs/superpowers/plans/2026-07-29-phase2b-trail-safety-and-audit-scope.md`. Full writeup: `DEVELOPMENT-TRACKING.md` same-date entry. Roadmap row: `REBUILD-PHASE2B` in `docs/ROADMAP.md`.

**What shipped:** (1) the edit-trail insert is now wrapped in its own `try/catch` so a bookkeeping failure can never again be reported as a failed save; (2) migrations `0040`+`0041` applied to production (owner chose to push both together, since `supabase db push` has no per-migration selector); (3) the stock audit now excludes deliberately non-inventory ingredients; (3b, engine-critical, reviewed as such) the consumption engine itself (`lib/inventory-consumption.ts`, `lib/full-history-recompute.ts`) now skips non-inventory ingredients too, threaded through POS checkout, order edit, and the full-history replay — not just the audit's read side; (4) live re-run.

**Live result, first reading reflecting both the PO-037 repair and the non-inventory exclusions:** the owner has ticked **6** ingredients non-inventory, not the 3 originally discussed (Đá viên, Nước, Nước sôi, Trái tắc, Trái chanh, plus Nước đường which was not previously flagged in this program). Only **Lá hồng trà (-2.009,58 g)** remains genuinely negative, down from 8 on 2026-07-29's first correct reading. Sữa đặc and Siro việt quất are no longer negative at all — consistent with the owner having entered the missing purchases `ING003-TRACE-1` recommended. Cost mismatches rose from 16 to 1,275 lines (net -790,395 VND); expected, not new damage — PO-037's edit and the newly-entered purchases wrote fresh backdated `PO_RECEIPT` rows, so the *stored* ledger is stale relative to this engine's own from-scratch replay until Phase 4 rebuilds it.

**Verification:** all 5 tasks TDD, `tsc` clean and full suite green after every task (841→847, +6), `next build` passed. No data rebuilt or corrected; only the two schema migrations plus one clearly-labeled verification row in the now-real `purchase_order_edits` table.

## 2026-07-29 - CLOSED, 6/6 tasks: clean rebuild program, Phases 1-2

**Done 2026-07-29.** All 6 tasks complete, TDD throughout (RED confirmed before each implementation), `tsc` clean and full suite green after every task (822→841, +19), `next build` passed, zero database writes, PO-037 untouched. Full writeup: `DEVELOPMENT-TRACKING.md` same-date entry "Clean Rebuild Program, Phases 1-2". Roadmap row: `REBUILD-PHASE1-2` in `docs/ROADMAP.md`.

**Two things the owner needs to know before using what this shipped:**
- Task 1's fixed audit is the first correct reading ever: **8 items are genuinely negative** (not a data-quality artifact) — Nước sôi, Đá viên, Sữa đặc, Lá hồng trà, Trái tắc, Siro việt quất, Nước, Trái chanh. Nước/Nước sôi are plausibly non-inventory-tracked (never purchased by design); not concluded.
- **Migration `0041` (purchase order edit trail) is written but not yet applied to production.** If the new admin-edit feature (Task 4) is used before `supabase db push` runs for `0041`, the PO edit itself will still succeed, but the edit-trail insert right after it will throw against a missing table — the UI will report failure even though the edit already committed. Apply `0041` first.

Task 5's duplicate-item diagnostic closed the last alternative explanation for Sữa đặc's negative balance: 0 name-twin id pairs anywhere in the 58-item catalog, reconfirming `ING003-TRACE-1` — the purchases were simply never entered, not lost under a different item id.

**What comes next:** Phase 3 (backup plus a verified restore drill) must complete before Phase 4 touches any data. Phase 4 waits on the owner's own PO-037 edit through the new admin feature. Neither is started.

---

## 2026-07-29 - (superseded above) clean rebuild program, Phases 1-2

Owner approved the clean rebuild program on 2026-07-29 after reviewing the
evidence. Program spec:
`docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`.
Plan for these two phases:
`docs/superpowers/plans/2026-07-29-phase1-2-guards-and-po-edit.md` (6 tasks, TDD).

**Read the plan; it carries the full detail.** The essentials:

- Task 1 fixes the reason every audit read clean while the owner's screen showed
  a negative. `scripts/audit-full-history-recompute.ts:156` filters negatives
  out of `qtyFindings`, which contains only *mismatched* items, so a negative
  balance the system agrees with itself about is unreportable. Sữa đặc is
  -6,651 g on both sides. After the fix, **re-run live and expect a non-zero
  count** — say so plainly to the owner; it is the first correct reading.
- Task 2 adds the guard that would have caught PO-037: reject a COMPLETED save
  whose header total disagrees with the sum of its lines. COMPLETED only.
- Tasks 3-4 add a PO edit trail and admin-only editing of completed POs behind
  an explicit `?edit=1`. **No RPC or migration work is needed for the edit
  itself** — `save_purchase_order_atomic` (migration 0006) already replaces
  lines and `PO_RECEIPT` rows in one transaction. Note the detail page currently
  has no session or role check at all; Task 4 adds it.
- Task 5 tests the last alternative explanation for Sữa đặc before Phase 4, so a
  rebuild reproducing the same negative is not mistaken for a failed rebuild.

**Do not edit PO-037.** The owner will do it himself through the Task 4 feature;
that is the whole reason the feature is being built.

**Hard constraints.** No data rebuild, no corrections, no deletions anywhere in
this plan — Task 5 is read-only. No Lodash (not installed). Runner is
`npx vite-node`. Owner-facing output in Vietnamese with real names.

Phase 3 (backup plus a **verified restore drill**) must complete before Phase 4
touches data. It is not in this plan and is not optional.

## 2026-07-29 - URGENT, QUEUED for Claude Sonnet 5: purchase-order header total does not match its lines

Owner-reported, with a screenshot of `/admin/inventory/purchase-orders/PO-037`.
**Do this before the ING-003 trace below** — it is cheaper, systemic, and if it
hits it very likely explains the negative balances that trace is chasing.

### The symptom

PO-037 (transaction date 25/6/2026, status COMPLETED) displays:

- Line items: a single row — Trân châu trắng Bibi, Túi, qty 2, 51,000 = **102,000**
- Tổng tiền hàng (`po.subtotal_amount`): **3,571,000**
- Tổng cộng (`po.total_amount`): **3,571,000**
- Shipping, tax, voucher, discount: all 0

3,469,000 of goods appear in the header total with no line to support them.

### The mechanism, verified in code

`app/admin/inventory/purchase-orders/actions.ts:53`:

```typescript
const subtotal_amount = Number(formData.get("subtotal_amount") || 0);
```

The header subtotal is **taken verbatim from the client form**. The server never
recomputes it from the `Purchase_Order_Lines` it saves in the same request, and
never validates one against the other. `total_amount` is then derived from that
unvalidated subtotal at line 67. A PO whose lines were lost, truncated, or never
submitted keeps a header total that no line supports, silently.

The detail page renders `po.subtotal_amount` and `po.total_amount` directly
(`app/admin/inventory/purchase-orders/[id]/page.tsx:106,122`), so the screen is
faithfully reporting stored data. This is not a display bug.

Ruled out while investigating: `findAllNoCache` keyset pagination
(`lib/sheets_db.ts:204-226`) is correct — it pages on `id` with `.gt()` and
terminates on a short page, so lines are not being lost to a row cap. The
detail page's client-side filter accepts both `po_id` and `purchase_order_id`,
so a column-name mismatch is not it either.

### Why this may be the inventory root cause

Stock is credited **per line**, not from the header total. If goods were
received and paid for but their lines were never saved, the stock was never
credited — which is exactly the shape of an unexplained negative balance that
purchases-minus-sales cannot account for.

This also explains why every audit so far reported clean.
`scripts/audit-po-save-ledger.ts` checks that ledger rows match the PO's
**lines** (last run: 0/58 mismatches). If lines went missing at save time, the
ledger agrees with the surviving lines and the audit passes, while the header
total silently disagrees. **No audit has ever compared a PO's header total
against the sum of its own lines.** That is the blind spot.

### The task

- `[ ]` Write a read-only audit comparing, for **every** purchase order,
  `subtotal_amount` against the summed `subtotal` of its `Purchase_Order_Lines`.
  Report every PO where they differ, with both figures, the delta, the line
  count, the status, and the transaction date. Model it on
  `lib/*-audit.ts` + `scripts/audit-*.ts` (pure module + thin CLI wrapper, tests
  for the pure part), same as `lib/inventory-balance-audit.ts`.
- `[ ]` Run it against production, read-only. Report how many POs are affected
  and the total value involved.
- `[ ]` For PO-037 specifically, report how many `Purchase_Order_Lines` rows
  actually exist and how many `Stock_Ledger` PO_RECEIPT rows reference it.
- `[ ]` Cross-check whether any affected PO contains Sữa đặc (ING-003) or Siro
  việt quất — the two ingredients the owner sees negative.
- `[ ]` Report to the owner in Vietnamese with real names, then update
  `DEVELOPMENT-TRACKING.md` and `docs/ROADMAP.md`.

### Open question only the owner can answer

Whether PO-037 genuinely contained ~3.5 million of goods on 25/6 or only the
102,000 of boba. That decides whether this is missing stock (goods received and
never credited) or a stale header number (cosmetic plus wrong cost allocation).
The audit's breadth tells us how widespread it is either way, so it does not
need to wait for the answer.

### Hard constraints

Zero database writes. Do not correct any PO, line, or ledger row — a fix
rewrites purchase and cost history and needs its own spec plus owner approval.
Note the cost coupling before designing any fix:
`lib/purchase-ledger-rebuild.ts:133` uses `subtotal_amount` as the denominator
when allocating shipping/tax/voucher across lines, so changing it moves landed
cost and therefore MAC. Runner is `npx vite-node`. Lodash is not installed.

## 2026-07-29 - CLOSED, root cause found: trace why Sữa đặc (ING-003) is 6.4kg negative

Owner supplied screenshots of two live screens. This supersedes the batch-yield
line of investigation, which is dead (see the section below).

### Two measured facts, both verified in code

**Fact 1 — the same page shows two different balances for the same ingredient.**
On `/admin/reports/stock`:

| Table | Data source | Sữa đặc |
|---|---|---|
| Gợi ý đặt hàng lại | `computeReorderSuggestions` → `buildInventoryBalances(stockLedger, asOf)`, i.e. summed `Stock_Ledger` (`lib/reorder-suggestion.ts:122`) | **-6,471 g** |
| Quản lý & Cân bằng Tồn kho | `getRealtimeStock` → `loadRealtimeStock` → `findAllNoCache("Inventory_Balances")` (`app/admin/inventory/actions.ts:419-429`) | **-6,651 g** |

180 g apart. `/admin/reports/daily` agrees with the reorder figure (-6,471 g).
Both paths share the `sheets-Stock_Ledger` cache tag and the reorder path has
`revalidate: 60`, so cache skew explains at most ~60 seconds of sales — check
whether that is plausible before assuming genuine drift.

Relevant risk already documented in the code by its own author
(`app/admin/inventory/actions.ts:421-427`): `Inventory_Balances` is written
**only by a database trigger**, never through the app's own
`insert()`/`touchRevalidate()` path. Any `stock_ledger` write originating
outside the app (a `scripts/` tool, an RPC, a migration, manual SQL) updates the
balance table without invalidating the app cache.

`scripts/audit-inventory-balances.ts` exists precisely to measure this drift.
Its introducing commit (`cec3ab7`) states it was **not run against production**
because migration 0038 had not been applied there yet. 0038 and the 0039 hotfix
have since shipped. The owner has separately asked for this run; fold its result
in here.

**Fact 2 — the drift is NOT the owner's problem.** Both numbers are deeply
negative. Correcting the 180 g gap moves -6,651 to -6,471 and changes nothing
that matters. **The unexplained quantity is the ~6.4 kg itself.**

### What makes this newly tractable

`docs/audits/2026-07-23-full-history-recompute-report.json` (2,229 lines
replayed) reports `quantity_items_with_diff: 0` and
`quantity_items_negative_theoretical: 0`. As of 2026-07-23 **nothing was
negative and recorded matched recomputed.** Either the negative appeared inside
the last six days — a narrow, searchable window — or the engine's re-derived
"theoretical" diverges from the raw `Stock_Ledger` sum that the screens
actually display. Establish which of those two is true first; it splits the
investigation cleanly and cheaply.

### An untested pattern, offered as a lead and nothing more

The two negative raw ingredients are bought in container units and stocked in
measure units: Sữa đặc (reorder suggests "12 Lon", stocked in g) and Siro việt
quất ("1 Chai", stocked in ml). The healthy ones on the same screen — Đường
trắng 2,000 g, Bột cacao 5,730.4 g — are not container-bought. Purchase-side
unit conversion is therefore worth checking early. Note the counter-evidence
before spending time on it: `lib/purchase-ledger-rebuild.ts:resolveConversion`
*throws* on a missing, mismatched, or ambiguous conversion, so a wrong **rate**
is possible but a missing conversion is not. Treat this as a lead to test, not
a conclusion to confirm.

### The task

- `[x]` Run `npx vite-node scripts/audit-inventory-balances.ts` against
  production, read-only. Report the drift count and whether Sữa đặc's 180 g is
  among it. **Done 2026-07-29: 0/54 mismatches. The 180 g gap is NOT among
  them** — `Inventory_Balances` agrees exactly with the full `Stock_Ledger`
  sum for Sữa đặc (-6,651 g both ways), so it is not a materialized-balance
  drift bug. The gap must come from the reorder-suggestion page's own
  computation path or its 60s cache, not from the ledger/balance table
  disagreeing.
- `[x]` Write a read-only, one-off trace for ING-003 (Sữa đặc): every
  `Stock_Ledger` row in chronological order with a **running balance** after
  each row, the transaction type, and the source reference. Find the first row
  where the balance goes negative and report what that row is. **Done
  2026-07-29** (`scripts/trace-ing003-sua-dac.ts`, 1,628 rows). First negative
  crossing: row 1,444/1,628, `2026-07-17T06:00:09`, an ordinary `SALES_CONSUME`
  of -40 g (balance +9 g → -31 g). The row itself is unremarkable.
- `[x]` From that row, determine the cause. Report it with evidence, in
  Vietnamese, using real ingredient names. **Done 2026-07-29.** Every one of
  the 184 rows from that point to the end of the ledger is `SALES_CONSUME` —
  zero `PO_RECEIPT` rows appear anywhere after it. Independently confirmed via
  `scripts/check-ing003-purchase-orders.ts` (joins `Purchase_Order_Lines` →
  `Purchased_Items` SPM-010/011/012 → `ING-003`): exactly 7 purchase-order
  lines exist for Sữa đặc in the system's whole history, the last one
  `PO-021`, transaction-dated 2026-05-16. **No purchase has been entered
  since that date — not a missing/orphaned entry, there is nothing after it.**
  Root cause: balance stood at +45,234 g right after `PO-021`; 2.5+ months of
  continuous ordinary sales with zero replenishment mechanically drained it
  past zero on 2026-07-17 and down to today's -6,651 g. This eliminates the
  "untested pattern" lead above (container-vs-measure-unit conversion) as
  moot — there is no purchase in the relevant window to have a wrong rate on.
- `[x]` Re-run `scripts/audit-full-history-recompute.ts` so the 2026-07-23
  baseline is refreshed, and state whether the engine now reports negatives too.
  **Done 2026-07-29.** 0/54 items show any theoretical-vs-recorded quantity
  difference, unchanged from 07-23, including Sữa đặc — ground truth
  (recomputed from trusted purchases + sales + recipes only) agrees exactly
  with what's recorded, both sides at -6,651 g. **Correction to Fact 2 above:**
  `quantity_items_negative_theoretical: 0` never meant "nothing was negative
  as of 07-23" — that field only flags items that are *both* negative *and*
  mismatched against recorded. An item whose recomputed and recorded balances
  agree exactly (Sữa đặc, 0 diff throughout) never appears there even while
  negative. The 07-17 crossing predates the 07-23 report; the report's own
  summary metric structurally cannot surface a negative that already matches
  what's recorded, since there's no discrepancy to log as a "finding."
- `[x]` Update `DEVELOPMENT-TRACKING.md` and `docs/ROADMAP.md`. Done
  2026-07-29 (roadmap row `ING003-TRACE-1`).

**Outcome:** the ~6.4 kg is fully explained and evidenced, not merely
theorized. This is a real, plain data gap — Sữa đặc has not had a purchase
entered in over two months while it kept being sold — not an engine bug, not
a batch-yield or unit-conversion error, and not a materialized-balance drift
issue. Nothing was corrected, per the hard constraints below; this is for the
owner to act on operationally (enter the missing purchases or confirm the gap
and decide next steps).

### Hard constraints

Zero database writes. No corrections of anything found — a fix needs its own
spec and the owner's approval, and any correction here rewrites financial
history. Owner-facing output uses real names, never codes (`CLAUDE.md` §7).
Runner is `npx vite-node`. Lodash is not installed; do not add it.

**Do not form a conclusion before the ING-003 trace is in hand.** Three
hypotheses have already been proposed and killed on this problem (missing
opening balance, semi-product batch yield, and — pending Fact 1's resolution —
possibly materialized-balance drift). All three came from reading code and
reasoning forward. The trace reads the actual data backwards from the symptom,
which is why it goes first.

## 2026-07-29 - CLOSED, hypothesis dead: Phase 0 semi-product batch-yield diagnostic

Owner-approved. Plan: `docs/superpowers/plans/2026-07-27-phase0-semi-product-yield-diagnostic.md`.
Spec: `docs/superpowers/specs/2026-07-27-inventory-transparency-design.md`. Both
committed in `0501714`.

**Why this exists.** The owner reports inventory numbers that do not match
reality and that he cannot trace, and his confidence is falling. His own
reasoning narrowed the cause: he records every purchase and every sale but
deliberately never records waste, and unrecorded waste can only push computed
stock *up*. Every negative balance is therefore provably a system or data-entry
fault, never real-world leakage.

**Leading hypothesis.** `semi_products.batch_yield` carries no unit. Implicit
production consumes `(cooking_recipe_quantity / batch_yield) * shortfall`
(`lib/inventory-consumption.ts:122`, `:130`), the column is `numeric not null
default 1` with a further `|| 1` fallback at `:205`, and nothing constrains it
to agree with the `base_unit` its consumers use. A yield entered as `2` (litres)
where drink recipes consume in ml over-consumes raw ingredients 1000x, silently,
and compounds because `Math.max(0, ...)` at `:88` clamps negative semi-product
stock to zero so every later sale re-explodes the full cooking recipe. Fits both
symptoms: deep negatives despite complete purchase/sales data, and inflated COGS.

**Ruled out already — do not re-investigate.** Missing opening balance. No such
concept exists in any migration, but the owner confirmed POs were entered from
the very first purchase, made to test recipes before any selling began, so
recompute starting every ingredient at zero is correct.

- `[x]` Task 1: `lib/semi-product-yield-audit.ts` + tests — parsing and types.
  Done 2026-07-29, commit `439ea27`.
- `[x]` Task 2: flag classification and implied-consumption arithmetic. Done
  2026-07-29, commit `4ad8274`.
- `[x]` Task 3: `scripts/audit-semi-product-yield.ts`, read-only wrapper, run
  live with `npx vite-node`. Done 2026-07-29, commit `5fc1934`. Live result:
  **hypothesis dead** — all 13 semi-products in active use flagged `OK`, 0
  suspicious. See `docs/audits/2026-07-29-semi-product-yield-diagnostic.json`.
- `[x]` Task 4: report to owner in Vietnamese using real ingredient names, then
  update `DEVELOPMENT-TRACKING.md` and `docs/ROADMAP.md`. Done 2026-07-29.

**Outcome:** the batch-yield unit-mismatch hypothesis is eliminated. Every
semi-product's `batch_yield` is correctly scaled to its `base_unit` — ratios
of largest cooking input to yield ranged 0.32-1.90, nowhere near the 100x
scale-error threshold. Next step per the spec's own contingency: Feature 2
(owner-run reconciliation with negative-cause classification).

**Hard constraints.** Zero database writes; the only artifact is a dated JSON
file under `docs/audits/`. No corrections of anything found — that needs its own
spec and owner approval. Lodash is *not* installed despite the global
`CLAUDE.md` preference; do not add it. Script runner is `npx vite-node`, not
`tsx`. Owner-facing output must use real names, never codes (`CLAUDE.md` §7).

**A negative result is a real result.** If no suspicious yield turns up, say so
plainly; that kills the leading candidate and redirects to Feature 2 of the spec.

Verified against the current tree on 2026-07-29: the pos-offline-resilience work
did not touch `lib/inventory-consumption.ts` or `lib/purchase-ledger-rebuild.ts`,
and offline orders keep their real sale timestamp
(`lib/pos-captured-at.ts`, 30-day past window), so replay chronology is intact
and the analysis above still holds.

## 2026-07-24 - COGS-5 pipeline root-cause review

- `[x]` Disproved the open second-event hypothesis with a new paginated,
  read-only live audit: all 41 prior writes among the 112 COGS-5 target lines
  came from `task-3.9-historical-gap-recovery-2026-07-21`; 0 came from a
  durable backdated-ledger event.
- `[x]` Confirmed the real COGS-5 incident was the naive correction crossing
  an accepted baseline-lock boundary. The 96 locked writes were reverted and
  migration 0030 now rejects locked lines in both recovery RPCs.
- `[x]` Fixed a separate lifecycle defect found during the review: zero-change
  ledger/recipe events are now marked RECOMPUTED instead of remaining PENDING
  forever. The CLI apply path settles them too.
- `[x]` Added the synthetic two-event regression: the first event applies the
  full correction and the already-incorporated second event settles cleanly
  with zero changes.
- `[x]` Verification: live read-only audit clean, targeted 16/16 tests, full
  suite 709/709, TypeScript 0 errors, and production build passed.
- `[x]` No production data was written.

Evidence: `docs/audits/2026-07-24-cogs5-pipeline-root-cause-review.md`.

Commit: this commit.

## 2026-07-24 - REV-4 reorder-suggestion backend review

- `[x]` Confirmed the UOM direction used throughout the purchase flow:
  `conversion_rate` is base units per purchase unit, so the suggestion must
  divide the base quantity by the conversion rate.
- `[x]` Rounded purchase-unit suggestions up to a whole unit so target stock
  coverage is not under-ordered.
- `[x]` Rejected non-finite and non-positive active conversion rates instead
  of returning invalid purchase quantities.
- `[x]` Deduplicated lead-time samples by purchase order and inventory item;
  repeated PO lines for the same item no longer bias the average.
- `[x]` Added regression coverage for all three cases. Verification: targeted
  11/11 tests, full suite 694/694, TypeScript 0 errors, production build passed,
  and `git diff --check` passed.
- `[x]` No UI files and no production data were changed.

Commit: this commit.

## 2026-07-24 - REV-2 audit-script review and auth remediation

- `[x]` Approved Claude's `purchase_order_id` correction in
  `audit-po-save-ledger`; live read-only verification found 0 missing and 0
  count mismatches across 58 completed purchase orders.
- `[x]` Approved the `AUTHENTICATED` policy for `/api/client-errors`, while
  preserving the stricter ADMIN policy for admin routes and actions.
- `[x]` Extended the auth audit to recognize only a fail-closed
  `CRON_SECRET` Bearer guard. A missing secret plus `Bearer undefined` is now
  rejected by the live route and by the static audit contract.
- `[x]` Closed four newly exposed admin access gaps in shift stock checks:
  both reads and both open/close mutations now require ADMIN.
- `[x]` Auth audit result: 0 mutation findings, 0 read findings, 0 route
  findings. Full verification: 692/692 tests, TypeScript 0 errors, production
  build passed.
- `[x]` No production data was written.

Commit: this commit.

## 2026-07-24 - REV-3 split-payment backend review

- `[x]` Re-reviewed migration `0024`, checkout payment-sum handling, and
  `RPT-SALES` per-payment attribution.
- `[x]` Confirmed the sales report attributes each stored payment row and uses
  the legacy order payment method only when no detail rows exist.
- `[x]` Found and fixed a transaction gap: editing an order created a new order
  version without `order_payments`, so an edited split payment was reported as
  one full-amount payment.
- `[x]` Unchanged split totals now preserve the exact payment allocation.
  Split-payment edits that change the total are rejected instead of guessing a
  new allocation; the current edit UI cannot enter a replacement split.
- `[x]` Added migration `0035_preserve_order_payments_on_edit.sql`: payment rows
  are inserted in the same edit transaction, direct checkout RPC callers must
  provide integer VND amounts, and payment table constraints cover IDs,
  methods, and non-negative stored amounts.
- `[x]` Verification: 686/686 tests pass, TypeScript reports 0 errors,
  production build passes, and `git diff --check` passes.
- `[!]` Migration 0035 is prepared but not deployed. It needs the required
  coordinator review before deployment and a live transaction probe afterward.
- `[!]` Review also observed that `order_payments` is absent from the backup
  table allowlist. No backup files were changed because the owner restricted
  this session to the assigned REV-3 scope; track that separately.

Commit: this commit.

## 2026-07-09 - Postgres role timezone migration Task 4

- `[x]` Added `supabase/migrations/0013_set_postgres_role_timezone.sql`.
- `[x]` Migration uses `current_database()` in a DO block to avoid hardcoding
  the database name.
- `[x]` Only `postgres` receives default timezone
  `Asia/Ho_Chi_Minh`; `service_role` and `authenticated` are intentionally
  unchanged.
- `[!]` Not deployed. Claude should deploy and verify from a fresh Supabase SQL
  Editor session.

Commit: pending.

## 2026-07-09 - PROD-028 BTP_SHORTFALL active drift investigation Task 3.1

- `[x]` Added read-only debug trace script
  `scripts/debug-prod-028-btp-shortfall.ts`.
- `[x]` Added investigation doc
  `docs/audits/2026-07-09-prod-028-btp-shortfall-investigation.md`.
- `[x]` Confirmed root cause: PO-051 for `NNL-007` was created at
  `2026-07-06T04:38:14.956371Z` but effective in stock ledger at
  `2026-07-04T17:00:00Z`; the 8 affected `PROD-028` sales occurred between
  those timestamps.
- `[x]` Replaying without PO-051 exactly matches stored COGS for sample lines:
  PHD000883 4,512 VND and PHD000893 11,280 VND.
- `[x]` Rejected PROD-028 recipe gap and POS-vs-audit algorithm mismatch for
  this active source.
- `[!]` Recommended Task 3.2 backdated purchase receipt impact detection/policy
  before Option B recovery. Option A lock remains possible only as a snapshot.
- `[!]` No code fix, no migration deploy, no lock insert, and no recovery apply.

Commit: pending.

## 2026-07-09 - MAC drift baseline recovery plan Task 3

- `[x]` Revised live baseline: 170 `Order_Lines_V2` rows, audit total delta
  +119,782 VND.
- `[x]` Added read-only audit script
  `scripts/audit-mac-drift-baseline.ts`.
- `[x]` Added audit document
  `docs/audits/2026-07-09-mac-drift-baseline-audit.md`.
- `[x]` Added line artifact
  `docs/audits/2026-07-09-mac-drift-baseline-lines.json`.
- `[x]` Investigated the old 164-line baseline movement. Current data has 8
  post-2026-07-02 non-migrated live POS lines for `PROD-028` totaling +713 VND;
  only 2/170 drift lines have migrated markers.
- `[x]` Added migration `0012_mac_drift_baseline_locks.sql` targeting
  `order_line_id`, with an update/delete prevention trigger and atomic recovery
  RPC.
- `[x]` Added dry-run recovery script `scripts/recover-mac-drift.ts`; generated
  `docs/audits/2026-07-09-mac-drift-recovery-plan.json`.
- `[!]` Migration 0012 was not deployed; no lock rows inserted; recovery
  `--apply` was not executed.

Commit: pending.

## 2026-07-09 - Hong to Luc idempotency precision fix Task 2.1

- `[x]` Chose Option C: SQL-side rounding in the idempotent rerun check.
- `[x]` Added migration `0011_hong_to_luc_idempotency_precision_fix.sql`.
- `[x]` Existing-run semantic ledger multiset comparison now rounds expected
  `quantity_change` to 6 decimals before comparing with stored
  `stock_ledger.quantity_change`.
- `[x]` Rejected Option A because changing `stock_ledger.quantity_change`
  precision is a global schema change with unnecessary blast radius.
- `[x]` Rejected Option B as insufficient alone because existing
  `data_migration_runs.write_set` rows would still contain full JS precision.
- `[x]` Regression test added for the 0011 SQL shape.
- `[!]` Not deployed to Supabase and no production `--apply` rerun executed.
  Claude should deploy 0011 and rerun:
  `node_modules\.bin\vite-node.cmd scripts\migrate-hong-tra-to-luc-tra.ts --apply --snapshot-id recovery-20260706T053239562Z`.
- `[~]` Remaining priority recommendation: Task 3 MAC drift baseline recovery
  before Task 4 timezone implementation, because Task 3 affects financial
  correctness while Task 4 is UX-only.

Commit: pending.

## 2026-07-09 - Hong to Luc migration idempotency rerun fix

- `[x]` Added migration `0010_hong_to_luc_idempotency_fix.sql` with
  `CREATE OR REPLACE FUNCTION public.apply_hong_to_luc_migration`.
- `[x]` Existing-run ledger verification now compares semantic ledger content as
  a multiset: `transaction_type`, `reference_id`, `item_reference`,
  `quantity_change`, and `source`.
- `[x]` Existing-run ledger verification intentionally ignores transient
  generated fields such as `id` and `created_at`.
- `[x]` Write path remains unchanged from migration 0009.
- `[x]` Regression test added for the SQL shape.
- `[!]` Not deployed to Supabase and no production `--apply` rerun executed.

Commit: pending.

## 2026-07-09 - Modifier recipe save hardening Phase 1.5

- `[x]` Modifier save now uses `planRecipeSave` for `MODIFIER` targets.
- `[x]` Duplicate open modifier recipes are resolved deterministically by latest
  `created_at`, matching the product save hardening pattern.
- `[x]` Unchanged latest modifier recipe is a no-op; changed ingredients close
  only the latest active recipe before inserting one new version.
- `[x]` Regression tests added for action-level duplicate-open behavior and
  generic `MODIFIER` helper coverage.
- `[x]` Vitest: 314/314 pass; TypeScript: 0 errors.
- `[!]` Modifier delete path still uses first open recipe selection and remains
  out of scope for this phase, matching the user prompt.

Commit: pending.

## 2026-07-04 - Recipe selection hardening

- `[x]` Product save selects the latest ACTIVE, open recipe deterministically.
- `[x]` Pure save planner verifies same=0 and changed=1 recipe versions.
- `[x]` Read-only recipe audit distinguishes true drops, type replacements,
  quantity changes, multiple-active rows, ambiguity, and invalid JSON.
- `[x]` Live audit: 49 variants; 1 cleanup candidate.
- `[!]` Hồng trà chanh `REC-068` removed Trái chanh and awaits the user's
  cleanup option; no data correction was executed.
- `[x]` Cà phê đá BTP-004 to ING-022 is a same-name type replacement, not
  corruption.
- `[x]` Vitest: 278/278 pass; TypeScript: 0 errors.
- `[x]` Claude review approved before commit.

Spec:
`docs/superpowers/specs/2026-07-04-recipe-selection-hardening-design.md`.

Report:
`docs/audits/2026-07-04-recipe-audit.md`.

## 2026-07-03 - PO-2 P&L request-scoped MAC index

- `[x]` Replaced two per-request P&L MAC index builds with one shared index.
- `[x]` Rejected the module hash-cache design after measuring a CPU regression.
- `[x]` Two builds: 24.78ms; one request-scoped build: 9.76ms.
- `[x]` Live P&L parity: 71 orders, 1,052,701 VND COGS, 25 ingredient rows.
- `[x]` P&L product/topping and ingredient consistency deltas: 0 VND.
- `[x]` Vitest: 266/266 pass; TypeScript: 0 errors.
- `[x]` Claude review approved before commit.
- `[!]` The existing 164 historical MAC drift lines (+119,036 VND) remain a
  separate data-recovery task and were not changed.

Spec:
`docs/superpowers/specs/2026-07-03-pnl-mac-index-reuse-design.md`.

## 2026-07-02 - P&L MAC performance

- `[x]` Added a reusable stock-ledger index grouped by item.
- `[x]` Replaced repeated historical balance rebuilds with a running window.
- `[x]` P&L benchmark improved from 18.17s to 3.80-4.31s.
- `[x]` Full Vitest: 257/257 pass.
- `[x]` P&L total, product/topping, and ingredient COGS reconcile at 0 VND
  delta.
- `[!]` Full TypeScript remains blocked by preserved untracked debug scripts;
  changed tracked files introduce no TypeScript errors.

Commits: `9a08486`, `5a0ada2`.

## 2026-07-02 - POS checkout performance and pending data recovery

- `[x]` Migration `0008_pos_checkout_performance.sql` deployed.
- `[x]` POS checkout uses compact inventory state and one atomic write.
- `[x]` Forced rollback probe: 0 partial orders, 0 partial lines.
- `[x]` Inventory-state parity: 0 mismatches across 48 items.
- `[x]` Reviewed `batch_yield`, `FLAT_VND`, POS ACTIVE filtering, and
  standalone topping setup/report/toggle.
- `[x]` June import structural review: 77 orders, 110 lines, 77 events, and 61
  ledger rows. The historical import script must not be reused.
- `[ ]` Resolve 3 negative-stock ingredients under a separate recovery plan.
- `[ ]` Prepare recovery for 164 historical MAC COGS line mismatches
  (+119,036 VND).
- `[!]` Full TypeScript hook is blocked by preserved untracked debug scripts
  from another session; tracked POS files introduce no remaining TS errors.

Record: `docs/audits/2026-07-02-pos-checkout-performance-review.md`.

> **READ FIRST**: `docs/COLLABORATION.md` — communication protocol + file map.

Yêu cầu gốc: review code changes của Claude (Phần A) + fix system-wide audit findings (Phần B).

Trạng thái từng item sẽ được update tại chỗ bằng marker (xem `docs/COLLABORATION.md` section 2):
- `[ ]` pending
- `[x]` done
- `[~]` partial
- `[!]` skip — có lý do
- `[-]` obsolete — direction change

---

## 2026-07-02 - Supabase recovery Phase B deployed

### Prepared and verified

- `[x]` Decimal PO receipt costs are preserved (`fdde00f`).
- `[x]` Atomic PO RPC and migration are prepared but not deployed (`207b067`).
- `[x]` PO line and receipt-ledger IDs no longer use read-max allocation
  (`81aca92`).
- `[x]` Migration validation rejects null/malformed payloads before ID
  allocation (`29a9e3c`).
- `[x]` Full test gate: 232/232 pass after snapshot tooling.
- `[x]` Read-only readiness source audit: 8/8.
- `[x]` Read-only remote probe: `NOT_DEPLOYED`.
- `[x]` Initial immutable dual-source snapshot captured and verified:
  `recovery-20260701T151428127Z` (108/108 files valid).
- `[x]` Fresh pre-deployment snapshot captured and verified:
  `recovery-20260701T152243267Z` (108/108 files valid).
- `[x]` Migration `0006_atomic_purchase_order_write.sql` deployed.
- `[x]` Remote guard probe reports `READY`.
- `[x]` `savePurchaseOrder` uses the atomic RPC.
- `[x]` Forced failure on PO-048 rolled back with identical before/after hash.

### Must not be skipped

- `[x]` Purchase-order safety deployment completed without historical data
  correction.
- `[!]` Create another fresh immutable snapshot immediately before historical
  data repair; operational data continues to change.
- `[x]` Historical material PO rounding drift repaired through reviewed plan
  `PURCHASE-COST-ROUNDING-2026-07-02`; 3 audit-log rows, idempotent re-run 0.
- `[x]` Material purchase-cost mismatches remaining: 0.
- `[ ]` Diagnose and resolve the 3 remaining negative-stock ingredients.
- `[ ]` Prepare a separate recovery plan for 164 historical MAC COGS lines;
  do not combine it with inventory-quantity corrections.

Current production baseline remains dirty: 3 negative stock items, 119 MAC
drift lines (+121,370 VND), and 3 material PO cost mismatches. No production
data was written during Phase B.

---

## Pending hand-off tasks (by owner)

Bảng tổng hợp các task đang chờ owner khác pick up. Chi tiết trong từng direction log entry bên dưới.

> **Roadmap đầy đủ**: `docs/audits/system-optimization-roadmap.md` — tổng hợp toàn bộ optimization tasks (P0-P3), để long-term planning.

### Antigravity (UI)

| Marker | Task | File | Spec |
|---|---|---|---|
| `[x]` | Admin toggle page (server component) | `app/admin/products/toppings/page.tsx` (new) | `docs/superpowers/specs/2026-06-27-topping-standalone-design.md` §Admin UI |
| `[x]` | Admin toggle component (client) | `components/ToppingsManager.tsx` (new) | same spec |
| `[x]` | Toggle server action | `app/admin/products/toppings/actions.ts` (new) | same spec §Server action |
| `[!]` | (Codex review required after Antigravity PR) | — | per COLLABORATION.md rule C |

### Codex (engine / data review)

| Marker | Task | Notes |
|---|---|---|
| `[ ]` | Post-hoc review: `scripts/import-june-2026-sales.ts` (applied 2026-06-27) | Order creation + MAC COGS + ledger writes; user verbally approved without Codex review. |
| `[ ]` | Post-hoc review: `scripts/setup-topping-standalone.ts` (applied 2026-06-27) | Catalog mutation (CAT-007 + 7 products/variants/recipes). |
| `[ ]` | Review: POS filter fix `app/pos/page.tsx:42-45` (applied 2026-06-27 by Claude) | `status !== "DELETED"` → `status === "ACTIVE"`. Data flow impact. |
| `[!]` | Review: toggle server action after Antigravity ships it | Mutates Products sheet. |

---

## Direction change log

### 2026-06-27 (Antigravity) — UI-17 revision
- Remove copy button + truncation per user feedback.
- Show full ID (reality: short codes like SPM-001, not UUIDs).
- Commit: 59fa72bdde954b01bdb26f5b0b915b0df97d10e6.

### 2026-06-27 (Antigravity) — UI-18 inventory mobile cards
- Mobile (< 768px) card layout for inventory items table.
- Same pattern as UI-13 (commit 6f0a3c3).
- Commit: a6475a6783c369b38fd56c781cee6788f9d6cc2b.

### 2026-06-27 (Antigravity) — UI-12 mobile heatmap accordion fix

- Refactor mobile heatmap từ flat list (~200-300 cards) → day-grouped accordion (7 sections max, default collapsed).
- Native `<details>`+`<summary>` cho accessibility, zero JS.
- Commit: `09713a30e34f4be2ecc706aa4cfaa4dbaf5b8191`.
- Claude review pending.

### 2026-06-27 (Claude) — Standalone topping report classification (actions done)

- New: standalone topping sales (CAT-007 products) routed into topping sections of Sales + P&L reports. Spec `docs/superpowers/specs/2026-06-27-standalone-topping-report-classification-design.md`.
- Implementation: `app/admin/reports/actions.ts` — both `getSalesDataV2` and `getPnLDataV2` build `standaloneToppingToModId` map and merge standalone with add-on via `MOD:<id>` key.
- No UI changes (page filters still work with `MOD:` prefix preserved).
- **Codex review (pending)**: data-flow change in `app/admin/reports/actions.ts`.
- Verification: `rtk tsc` 0 errors, `rtk vitest` 197/197 pass.

### 2026-06-27 (Claude) — Topping standalone sales setup (data done, UI pending)

- New: standalone topping sales. Spec `docs/superpowers/specs/2026-06-27-topping-standalone-design.md`.
- Data layer APPLIED: CAT-007 "Topping" + 7 Products (PROD-029..035) + 7 Variants (VAR-038..044) + 7 Recipes (REC-071..077). Re-run `scripts/setup-topping-standalone.ts` (dry-run by default) is idempotent.
- POS filter fix `[x]` DONE by Claude 2026-06-27: `app/pos/page.tsx:42-45` changed `status !== "DELETED"` → `status === "ACTIVE"` for categories/products/variants/modifiers. Aligns POS with `docs/domain-dictionary.md` INACTIVE contract.
- **Antigravity tasks (pending)** — see "Pending hand-off tasks" table above:
  - `[~A]` Admin toggle page `app/admin/products/toppings/page.tsx`.
  - `[~A]` Admin toggle component `components/ToppingsManager.tsx`.
  - `[~A]` Toggle server action `app/admin/products/toppings/actions.ts`.
- **Codex review (pending)** — see "Pending hand-off tasks" table above.
- See `DEVELOPMENT-TRACKING.md` 2026-06-27 topping entry for full context.

### 2026-06-27 (Claude) — June 2026 sales backfill import (Phin Đi)

- User-provided spreadsheet backfilled: 110 line items → 77 orders, Phin Đi brand, June 1-26.
- Order_no range PHD000661 → PHD000747. Gross 1.045.000 VND, COGS 268.876 VND, GP 776.124 VND.
- See `DEVELOPMENT-TRACKING.md` 2026-06-27 entry for full summary.
- **Codex post-hoc review requested**: `scripts/import-june-2026-sales.ts` chạm `buildOrderFromCart` + `insertOrderV2Records` + MAC COGS + ledger. User approved `--apply` without Codex review (verbal). Suggest Codex spot-check script logic + audit results before depending on this data in COGS/FIFO/P&L work.
- **Follow-up for user (non-blocking)**:
  - `Products.brand_id` missing for PROD-027 (Khoai lang) and PROD-028 (Trứng luộc) — recommend set `BR-001`.
  - VAR-036 has no recipe → COGS = 0. Recommend configure recipe + `apply-cogs-recalc.ts` for June range.

### 2026-06-26 (Codex) — Phase 9 negative stock diagnosis

- Phase 9 diagnosis and dry-run resolve plan are ready for Claude/user review.
- Diagnosis script: `scripts/diagnose-negative-stock.ts`.
- Diagnosis output: `docs/audits/2026-06-26-negative-stock-diagnosis.json`.
- Resolve script: `scripts/resolve-negative-stock.ts`.
- Dry-run result: 6 rows planned, no data written.
- Classification counts: `MISSING_PRODUCTION_YIELD=5`, `PO_RECEIPT_GAP=1`.
- Proposed writes after approval:
  - `PRODUCTION_YIELD` backfill rows for `BTP-008`, `BTP-003`, `BTP-010`, `BTP-002`, `BTP-011`.
  - `STOCK_ADJUST` row for `ING-015` +10 ml.
- Status: waiting for Claude/user approval before running `node_modules\.bin\vite-node.cmd scripts\resolve-negative-stock.ts --apply`.

### 2026-06-27 (Claude Coordinator) — Phase 9 applied

- Apply executed by Claude after Codex ran out of token (reset 1 Jul 15:44).
- 5 PRODUCTION_YIELD rows inserted (ING-015 self-balanced before apply due to June 2026 sales backfill commits).
- Reference ID: `PHASE9-NEGATIVE-STOCK-2026-06-26`. unit_cost=0 for all 5 (no prior yield history).
- Post-apply verification: `audit-current-stock.ts` 0 negative, 197/197 tests pass, idempotent re-run = 0 rows.
- **MAC drift 101 mismatches pre-existing** (not caused by apply) — root cause: 5 Claude commits about June 2026 sales backfill + topping standalone added new BTP_SHORTFALL orders. Logic verified: `lib/mac-cogs.ts:37,43` filter yield unit_cost=0 out of MAC calc.
- **Codex retroactive review needed** when token refreshes:
  1. Verify Phase 9 apply correctness (5 PRODUCTION_YIELD rows in Stock_Ledger with reference `PHASE9-NEGATIVE-STOCK-2026-06-26`).
  2. Investigate 101 MAC drift mismatches from June 2026 sales backfill (separate issue, not Phase 9).
- Pre-apply snapshot: `docs/audits/2026-06-27-phase9-pre-apply-snapshot.txt`.

### 2026-06-26 — MAC COGS primary direction

- User approved switching primary COGS valuation FIFO → MAC.
- Inventory quantity control remains ledger-based via `Stock_Ledger.quantity_change`.
- FIFO demoted to audit/debug only.
- Design note: `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`.
- Migration applied: 1267 historical lines MAC-recalc'd, 272 BTP shortfall correction rows added. All audits clean.

### 2026-06-26 (Claude) — Open Questions resolved + P&L breakdown flag

Spec đã update với 3 Open Questions answered (Q1 rewrite, Q2 không populate SALES_CONSUME.unit_cost, Q3 lazy SP MAC).

**P0 issue còn tồn tại — DEFERRED TO CODEX**:

**P&L breakdown recompute FIFO thay vì dùng stored MAC** (spec violation).

- `app/admin/reports/actions.ts:449-501` `splitLineCogsBySaleSource` — recompute FIFO để split variant vs modifier.
- `lib/report-v2-allocators.ts` `breakdownCOGSByIngredient` — recompute FIFO để breakdown theo ingredient.
- Tổng COGS = MAC stored (đúng), nhưng breakdown có thể lệch.

**Why Codex**:
- Codex viết MAC engine + write paths.
- Có thể có lý do giữ FIFO breakdown (audit?) — confirm trước.
- Refactor cần design decision: proportionally split stored MAC theo recipe quantity, hoặc MAC recompute via consumption rows (không FIFO).

**Tasks cho Codex**:
1. Confirm có lý do giữ FIFO breakdown không, hay là bug cần fix.
2. Nếu fix: refactor `splitLineCogsBySaleSource` + `breakdownCOGSByIngredient` dùng stored MAC hoặc MAC recompute.
3. Viết audit `scripts/audit-pnl-mac-consistency.ts` verify P&L total = sum cost_at_sale.
4. Update R1 status trong handoff: nếu breakdown refactor, `filterLedgerForFifoInit` có thể không còn cần ở allocators (chỉ giữ cho audit scripts).

**Spec compliance** (Codex has authority to edit if needed):
- Spec section "Outstanding (P0 — deferred to Codex)" có full context.
- Claude đã add UI note MAC tại `app/admin/reports/pnl/page.tsx` (giải thích breakdown FIFO informational).
- Claude giữ nguyên WS-12 fix (filterLedgerForFifoInit) để FIFO allocators chạy đúng khi còn tồn tại.

**Impact trên handoff items**:
- R1 (filterLedgerForFifoInit): vẫn valid NGAY BÂY GIỜ — FIFO allocators vẫn dùng cho breakdown. **Sẽ obsolete nếu Codex refactor breakdown sang MAC**.
- R6 (audit scripts): vẫn valid.
- Bug Đào miếng fix: vẫn valid (modifier COGS = 0 do filter thiếu).
- CODE-5 (parseSpIngredients): đã done bởi Claude.

---

## Phần A — Review code changes của Claude (phiên 2026-06-25)

### File cần đọc

**Overview docs (3 file):**
1. `docs/COLLABORATION.md` — communication protocol (READ FIRST)
2. `DEVELOPMENT-TRACKING.md` — 4+ entries mới nhất (2 Claude + 4 Codex MAC migration)
3. `docs/audits/2026-06-25-full-system-audit-roadmap.md` — Phase 0-5, 5A, 6.1 done
4. `docs/audits/script-cleanup-plan.md` — Phase 6.1 output

**Code modified (7 file):**
- `lib/report-v2-allocators.ts` — export `filterLedgerForFifoInit`, apply 2 chỗ
- `lib/report-v2-allocators.test.ts` — +2 regression tests WS-12
- `app/admin/reports/actions.ts` — apply filter + Phase 5.2 fields + Phase 5.3 timezone
- `app/admin/reports/sales/page.tsx` — +2 UI cards
- `app/admin/inventory/actions.ts` — `getRealtimeStock` non-inv filter + `submitStockAdjustment` reason required
- `lib/purchase-ledger-rebuild.ts` — 4 error msg tiếng Việt
- `lib/purchase-ledger-rebuild.test.ts` — update 2 regex match

**Code mới (2 file):**
- `lib/report-time.ts` — `toSaigonUtcRange` helper
- `lib/report-time.test.ts` — 6 tests

**Audit scripts mới (10 file trong `scripts/`):**
- `audit-void-orders.ts` (3.3)
- `audit-order-total-consistency.ts` (3.4)
- `audit-stock-ledger-schema.ts` (4.1)
- `audit-stock-adjustments.ts` (4.3)
- `audit-po-save-ledger.ts` (2.3)
- `audit-negative-periods-classification.ts` (4.4)
- `generate-script-cleanup-plan.ts` (6.1)
- `verify-cogs-allocation-impact.ts` (verify)
- `spotcheck-mod004.ts` (verify)
- `audit-dao-mieng-report-cogs.ts` (Codex's, kept)

### 8 Review points (Claude đã note trong `DEVELOPMENT-TRACKING.md`)

- [ ] **R1** `filterLedgerForFifoInit` — có cần loại thêm `STOCK_ADJUST`/`EDIT_CONSUME`? So sánh `lib/cogs-drift-audit.ts:136-143`. *(Vẫn valid dù MAC primary — FIFO vẫn dùng cho breakdown UI)*
- [ ] **R2** `toSaigonUtcRange` — behavior với ISO input không timezone suffix.
- [ ] **R3** `getRealtimeStock` cache staleness 60s cho `is_non_inventory` toggle.
- [ ] **R4** `sales/page.tsx:37-51` redundant date conversion — có nên đơn giản hoá?
- [x] **R5** Pre-existing TS error `lib/modifier-recipe.test.ts:21`. **Done by Claude (phiên 2026-06-26)** — narrow qua `if (!result.ok)` trước khi access `.error`.
- [ ] **R6** 7 audit scripts mới — review naming, output, read-only contract.
- [ ] **R7** `submitStockAdjustment` reason validation — UI form phải pass reason.
- [ ] **R8** Vietnamese error messages render đúng qua UI toast.

### Additional issues found in Codex MAC code (2026-06-26 Claude verify)

- [x] **R9** TS error `MacLedgerEntry` thiếu `reference_id` ở `lib/mac-cogs.ts:4-10` dù `lib/mac-cogs-audit.ts:138` dùng. **Done by Claude** — thêm `id?: string; reference_id?: string` vào type.
- [x] **R10** Runtime crash risk `lib/mac-cogs-audit.ts:187,236` — `row.item_reference.startsWith` mà `item_reference?: string`. **Done by Claude** — wrap `String(row.item_reference || "")`.
- [ ] **R11** `btp-shortfall-reprocess.ts:126` perf O(n²) — `workingLedger.filter()` mỗi order re-scan + growing workingLedger. *(Defer — 1-shot migration, performance acceptable)*
- [x] **R12** `buildLineConsumptionRows` + `modifierQtyByIdFromLine` trùng 4 chỗ. **Done by Claude (phiên 2026-06-26)** — extract `buildLineConsumptionRows` to `lib/inventory-consumption.ts`, replace 4 implementations.
- [x] **R13** FIFO drift audit `scripts/audit-cogs-drift.ts` giờ report nhiều mismatch (FIFO ≠ MAC). **Done by Claude (phiên 2026-06-26)** — added 3-line warning đầu output giải thích FIFO informational only, point tới MAC audit.

### Verify commands

```bash
rtk node_modules/.bin/vitest run                                       # 166/166
rtk node_modules/.bin/vite-node.cmd scripts/audit-cogs-drift.ts        # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-current-stock.ts     # 0 negative
rtk node_modules/.bin/vite-node.cmd scripts/audit-order-ledger.ts      # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-purchase-ledger.ts   # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-void-orders.ts       # clean
rtk node_modules/.bin/vite-node.cmd scripts/audit-stock-ledger-schema.ts
rtk node_modules/.bin/vite-node.cmd scripts/audit-order-total-consistency.ts
rtk node_modules/.bin/vite-node.cmd scripts/audit-po-save-ledger.ts
rtk node_modules/.bin/tsc --noEmit                                     # 1 pre-existing error
```

### Bug Đào miếng — Root cause

3 hàm truyền full ledger vào `FIFOTracker.init()`. Init consume `SALES_CONSUME` → batches depleted → late-processed lines thấy 0 stock → modifier COGS = 0. Fix: filter `SALES_CONSUME` + `EDIT_REVERSAL` trước init (mirror `auditCogsDrift`). Evidence: `scripts/verify-cogs-allocation-impact.ts` shows MOD-006 0→4209, MOD-004 121891→76776, total unchanged.

---

## Phần B — System-wide audit findings

### B.1 — UI/UX Issues

#### Date/Time display
- [x] **UI-1** HIGH Tạo `lib/datetime.ts` helper `formatDateTime(iso, opts?)` dùng `Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })`. Thay 2 helper trùng `OrderTable.tsx:134` + `OrderDetailModal.tsx:28`. **Done by Claude** — `lib/datetime.ts` + 9 tests, apply ở `OrderTable.tsx`, `OrderDetailModal.tsx`, `StockTable.tsx`.
- [x] **UI-2** HIGH `StockTable.tsx:80` và các trang `.toLocaleString("vi-VN")` thiếu `timeZone` option. **Done by Claude** — dùng `formatDateTime` helper mới.
- [x] **UI-3** HIGH `SalesFilter.tsx:84` push URL `.toISOString()` raw → không friendly. **Done by Claude (phiên 2026-06-26)** — `toDateOnlyForUrl` YYYY-MM-DD + `parseDateParam` backward compat với ISO legacy. Server `toSaigonUtcRange` handle date-only.

#### Sizing & touch target
- [x] **UI-4** HIGH Touch target < 44px: `OrderDetailModal.tsx:64` close button, `SalesFilter.tsx:111-113` preset buttons. **Done by Claude** — tăng `min-h-[36px]` + `aria-label="Đóng"`. Codex verify `OrderTable.tsx:280` "Hủy đơn" button.
- [x] **UI-5** HIGH `sales/page.tsx:256` heatmap cell `text-[8px]`. **Done by Claude** — `text-[10px]`.
- [x] **UI-6** MED `pnl/page.tsx:128,184,243` `max-h-[484px]`. **Done by Claude** — `max-h-[60vh]` (3 chỗ + StockTable 1 chỗ).

#### Layout & consistency
- [x] **UI-7** HIGH `ModifiersClient.tsx:131` text English `"active recipes"`. **Done by Claude** — `"phiên bản hoạt động"`.
- [ ] **UI-8** MED `PurchaseOrderForm.tsx:213` placeholder. *(Defer — cần đọc CustomDatePicker)*
- [x] **UI-9** HIGH `PurchaseOrderForm.tsx:165` gửi `transaction_date.toISOString()`. **Done by Claude (phiên 2026-06-26)** — đổi sang `toSaigonIsoString(transactionDate)` từ `lib/datetime.ts`. Server parse đúng ngày Saigon bất kể deploy TZ.
- [x] **UI-10** MED Format tiền `XXđ` → `XX đ`. **Done by Claude** — sweep trong `OrderDetailModal.tsx` (6 chỗ).
- [x] **UI-11** MED `OrderTable.tsx:137` show giây. **Done by Claude** — dùng `formatDateTime(dateString)` mặc định không giây.
- [x] **UI-12** MED Heatmap mobile. **Done by Antigravity** — added list view for mobile and min-width 1120px for desktop touch targets (commit 204d2a4).
- [x] **UI-13** MED Mobile table card fallback. **Done by Antigravity** — added card layout for mobile (<768px) in sales and PnL tables (commit 6f0a3c3).
- [ ] **UI-14** MED PO form grid fallback. *(Defer — cần đọc PO form)*
- [ ] **UI-15** MED PO inputs `w-32` overflow. *(Defer — cần đọc PO form)*
- [x] **UI-16** MED `StockTable.tsx:103` icon `🔍`. **Done by Claude** — `aria-hidden="true"`.
- [x] **UI-17** MED `ItemsClient.tsx:106` item.id raw UUID. **Done by Antigravity** — added short ID display and hover copy button (commit f8e14e5).

#### Low severity
- [x] **UI-18** LOW `OrderTable.tsx:359` className conflict. **Done by Claude** — removed `bg-white` duplicate.
- [x] **UI-19** LOW backdrop opacity khác nhau. **Done by Claude** — unified `bg-black/50 backdrop-blur-sm` ở OrderDetailModal.
- [x] **UI-20** LOW `created_by` hardcoded. **Done by Claude (phiên 2026-06-26)** — server override bằng `auth.actor.name` (CODE-22), client append removed khỏi PurchaseOrderForm.
- [x] **UI-21** LOW PnL emoji icons. **Done by Claude** — `aria-hidden="true"` 3 chỗ.

### B.2 — Code Architecture

#### Type Safety
- [x] **CODE-1** HIGH `app/admin/orders/actions.ts:111-162, 208-228` `any[]` + `Number(x) || 0` lặp. **Done by Claude (phiên 2026-06-26)** — extracted `coerceOrderV2`/`coerceLineV2` to `lib/order-types.ts`. Áp dụng ở `app/admin/reports/actions.ts` (2 chỗ).
- [x] **CODE-2** MED `app/admin/orders/actions.ts:349` `require()` runtime. **Done by Claude (phiên 2026-06-26)** — đổi sang static `insertMany` import (cùng commit CODE-8).
- [ ] **CODE-3** MED `lib/report-v2-allocators.ts:43-48, 145, 262` `any[]`. Typed `LedgerEntry[]` + `SemiProductContext`.
- [ ] **CODE-4** LOW `app/admin/inventory/actions.ts:411` `submitStockAdjustment(data: any)`. Typed input.

#### Error Handling
- [x] **CODE-5** HIGH `lib/report-v2-allocators.ts:190, 214` `try { JSON.parse } catch {}` silent skip SP. **Done by Claude** — added `parseSpIngredients` helper throws on malformed JSON; replaced both `try/catch {}` blocks; throws with SP id in message.
- [ ] **CODE-6** MED `app/admin/inventory/purchase-orders/actions.ts:51` `JSON.parse(linesJson)` không try/catch.
- [ ] **CODE-7** LOW `app/admin/orders/actions.ts:117-121` silent catch. Log warning nếu non-empty.

#### Data Integrity
- [x] **CODE-8** CRITICAL `app/admin/orders/actions.ts:337-351` `voidOrderV2` 3 writes không transaction. **Done by Claude (phiên 2026-06-26)** — reorder fail-safe (reversal+event first, order update last) + idempotency guard reject double-VOIDED. Bonus CODE-2: replace `require()` runtime bằng static `insertMany` import.
- [x] **CODE-9** CRITICAL `app/admin/inventory/purchase-orders/actions.ts:81-93` update PO loop remove; fail giữa → mất dữ liệu. **Done by Claude (phiên 2026-06-26)** — replace loop remove với `removeMany` batch (atomic), accumulate line/ledger rows + `insertMany` batch. Giảm fail-between window đáng kể.
- [ ] **CODE-10** HIGH `app/admin/orders/actions.ts:472` `editOrderV2` race condition.
- [x] **CODE-11** HIGH `app/pos/actions.ts:138-155` `assignOrderNo` race → trùng order_no. **Done by Claude (phiên 2026-06-26)** — thêm `ensureUniqueOrderNo` post-insert verify + auto-regenerate khi collision.
- [ ] **CODE-12** MED `findAll` (cache 5min) cho reference data trong write-path.

#### Performance
- [x] **CODE-13** HIGH `app/admin/orders/actions.ts:113-115, 209-210` `.find()` O(n) per line → O(n²). **Done by Claude (phiên 2026-06-26)** — build `productById`/`variantById` Maps 1 lần trước map.
- [x] **CODE-14** HIGH `app/admin/inventory/items/actions.ts:182-227` `updatePurchasedItem` N+1. **Done by Codex (2026-06-26)** — added `updateMany` to `lib/sheets_db.ts`, covered it with `lib/sheets_db.test.ts`, and replaced the PO-line history update loop with one batch update.
- [ ] **CODE-15** HIGH `app/admin/inventory/purchase-orders/actions.ts:116-164` loop insert. Accumulate + `insertMany`.
- [x] **CODE-16** MED `app/admin/reports/actions.ts:321-322` tạo Set mỗi iteration. **Done by Claude (phiên 2026-06-26)** — build Set 1 lần trước filter.
- [ ] **CODE-17** MED `lib/cogs-drift-audit.ts:146-163` re-consume prior lines O(n²).

#### Code Duplication
- [x] **CODE-18** HIGH `buildLineConsumptionRows` + `costConsumptionRowsFIFO` trùng 3 chỗ (`pos/actions`, `admin/orders/actions`, `cogs-drift-audit`). **Done by Claude (phiên 2026-06-26)** — extracted to `lib/inventory-consumption.ts`.
- [x] **CODE-19** MED `coerceOrder`/`coerceLine` trùng. **Done by Claude (phiên 2026-06-26)** — same as CODE-1.
- [ ] **CODE-20** MED Block filter "COMPLETED + superseded_by empty" lặp 4 lần. Helper `filterEligibleOrders`.
- [ ] **CODE-21** MED SEMI_PRODUCT resolution trùng. Helper `resolveSemiProduct`.

#### Security
- [x] **CODE-22** CRITICAL Không server action nào check `session.user.role === "ADMIN"`. **Done by Claude (phiên 2026-06-26)** — `requireAdmin`/`resolveActor` ở `lib/auth.ts`. Apply: `voidOrderV2`, `editOrderV2`, `savePurchaseOrder`, `approveStockAdjustment`, `submitStockAdjustment` (refactor: bỏ trust client `role` param, dùng server-side).
- [ ] **CODE-23** LOW `lib/sheets_db.ts:132-149` `generateNewId` predictable. OK cho ledger.
- [ ] **CODE-24** MED `lib/sheets_db.ts:69-87` sheet name dynamic. Whitelist `ALLOWED_SHEETS`.

---

## Priority (updated 2026-06-26 sau MAC migration)

**Done items removed from priority** (Claude phiên 2026-06-25 + 2026-06-26):
- UI-1/2/4/5/6/7/10/11/16/18/19/21 — done
- CODE-5, R5, R9, R10 — done

| Priority | Items | Ghi chú |
|---|---|---|
| **P0 — Critical (security/data)** | CODE-22 (auth guard), CODE-8 (void txn), CODE-9 (PO txn), CODE-11 (order_no race) | Rủi ro mất dữ liệu / bảo mật. Codex ưu tiên. |
| **P1 — High (sau MAC migration)** | R11 (BTP perf), R12 (dedup 4 chỗ tăng sau MAC), R13 (FIFO drift warning), CODE-13/14/15 (perf N+1), UI-3 (URL date), UI-9 (PO date ISO) | Tăng ưu tiên vì MAC migration thêm code mới. |
| **P2 — Medium (cosmetic + refactor)** | UI-8/12/13/14/15/17/20, CODE-1/10/12/16/17/19-21/24, R1/2/3/4/6/7/8 | UI + cleanup. |
| **P3 — Low / defer (large or low-impact)** | CODE-2/3/4/7/23, Phase 6.3-6.5/7/8 | Large refactor hoặc cần design. |

---

## Next 3 phiên đề xuất

### Codex phiên tiếp theo

1. **Verify** Claude fixes (R9, R10, R5) — chạy `tsc --noEmit` clean.
2. **P0**: CODE-22 auth guard (lớn nhất, rủi ro cao nhất).
3. **P1**: R12 dedup `buildLineConsumptionRows` (4 chỗ giờ là 5 sau MAC).
4. **P1**: R13 add warning trong FIFO drift audit output.

### Claude phiên tiếp theo (nếu anh cần)

1. **P1**: UI-9 (PO transaction_date UTC → Saigon) — em đã tạo `toSaigonIsoString` helper sẵn trong `lib/datetime.ts`.
2. **P1**: UI-3 (SalesFilter URL date) — dùng `formatDate(iso)` từ helper.
3. **P2**: UI-8/14/15 (PO form polish).

### Sau khi cả 2 xong P0-P1

1. Phase 6.2 (script deletion — review từng script).
2. Phase 7 (mobile UI audit — cần dev server).
3. Phase 8 (offline/sync — cần design approval).

---

## Output mong đợi từ Codex

1. **Phần A**: Confirm/reject R1-R13. Flag thêm edge cases.
2. **Phần B**: Làm item `[ ]` còn lại theo priority. Mỗi fix commit riêng với `Codex:` prefix.
3. Update file này: chuyển `[ ]` → `[x]` khi xong, note commit sha.
4. Update `DEVELOPMENT-TRACKING.md` entry mới (newest first).
5. **Không push** unless explicitly asked.
6. Cuối phiên: đọc `docs/COLLABORATION.md` section 4 "Quy trình làm việc mỗi phiên".

## Quy tắc (CLAUDE.md + COLLABORATION.md)

- Code/comments: English only
- User-facing strings: tiếng Việt
- CamelCase, no emojis mới (cũ OK với `aria-hidden`)
- Surgical changes, simplicity first
- Transactions cho critical flows (P0)
- Lodash khi có thể
- Tuân thủ `docs/domain-dictionary.md`
- **Communication**: tuân thủ `docs/COLLABORATION.md`
