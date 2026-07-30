# Design Spec: Clean Rebuild Program

Status: proposed, awaiting owner approval
Author: Claude Opus 5 (design only)
Date: 2026-07-29

## 1. Owner decision being recorded

The owner decided on 2026-07-29, after reviewing the evidence below, to stop
incremental auditing and rebuild the derived data from source. His stated
reasoning: only recipes, sales orders, and purchase orders are trustworthy;
PO-037's lines were not preserved by the system; and continuous re-auditing of
accumulated corrections is consuming time without converging. He is pausing
expansion until the numbers are trustworthy.

Specifically he asked for:

1. The ability to edit a COMPLETED purchase order himself, admin-only, so he can
   restore PO-037 without handing invoice contents to an agent.
2. Deletion of all derived stock-deduction data and a full recomputation.
3. COGS recomputed on top of the rebuilt stock basis.
4. No requirement to preserve historical data or historical documentation.
5. Repository restructuring done as part of the same effort.
6. A physical stock count performed by him once features and data are complete.

Two concerns were raised before this decision and answered:

- *"A wipe changes nothing today"* — correct as of now (`quantity_items_with_diff: 0`
  across 2,358 replayed lines on both 2026-07-23 and 2026-07-29), but it stops
  being true the moment PO-037's missing lines are restored. The rebuild is
  therefore sequenced after that edit, where it does real work.
- *"Physical counts are the only anchor to reality and must be preserved"* —
  moot in practice. The Sữa đặc trace (1,628 rows) contains zero `STOCK_ADJUST`
  entries; the owner confirmed he has never counted. Phase 3 still verifies this
  system-wide before deleting anything.

## 2. What this program fixes, and the defect that caused it

`app/admin/inventory/purchase-orders/actions.ts:53` takes `subtotal_amount`
verbatim from the client and never validates it against the lines saved in the
same request. PO-037 (created 2026-06-26) carries a 3,571,000 header against a
single 102,000 line.

The line loss itself is already fixed: purchase-order writes became atomic on
2026-07-02 (`c243757`, migration `0006`). PO-037 predates that by six days and
is the sole survivor of the non-atomic era — 1 of 61 POs, confirmed by the
header-vs-lines audit Sonnet built on 2026-07-29.

**A second defect, found 2026-07-29 and not yet fixed**, explains why every
audit reported clean while the owner's screen showed negative stock.
`scripts/audit-full-history-recompute.ts:156`:

```typescript
const negativeTheoretical = qtyFindings.filter(f => f.theoretical < -0.01);
```

`qtyFindings` contains only items where theoretical **disagrees with** recorded.
An item is therefore only tested for negativity if it is also a mismatch. Sữa
đặc, at -6,651 g on both sides, can never be counted. The headline
`quantity_items_negative_theoretical: 0` is structurally incapable of reporting
a negative balance the system agrees with itself about. This must be fixed
before the rebuild, because it is the instrument used to verify the result.

## 3. What is source, what is derived

Per `CLAUDE.md` section 9, unchanged by this program.

| Class | Tables / row types | Treatment |
|---|---|---|
| **Source — never deleted, never rewritten** | `recipes`, `orders_v`/`order_lines_v` (except `cost_at_sale`), `purchase_orders`, `purchase_order_lines`, `stock_ledger` rows of type `PO_RECEIPT` and `STOCK_ADJUST` | Preserved exactly |
| **Derived — deleted and recomputed** | `stock_ledger` rows of type `SALES_CONSUME`, `PRODUCTION_CONSUME`, `PRODUCTION_YIELD`, `RECLASSIFICATION_REVERSAL`, `EDIT_REVERSAL`, `EDIT_CONSUME`; `inventory_balances`; `order_lines_v.cost_at_sale` | Rebuilt from source |

`lib/full-history-recompute.ts` already enforces exactly this split
(`TRUSTED_PRIMITIVE_TYPES = {STOCK_ADJUST}`), and
`scripts/apply-full-history-stock-ledger-rebuild.ts` already performs the
rebuild per order through the `rebuild_stock_ledger_for_order` RPC (migration
0034). Its current scope is limited to orders that previous correction rounds
touched; this program widens that to every order.

## 4. Risks the owner has accepted

- **Historical P&L will change.** Costs for every period after PO-037's
  transaction date move once the missing purchase enters the weighted average.
- ~~**Baseline locks will be released.**~~ **Withdrawn 2026-07-30 — this risk
  does not exist.** `audit_baseline_locks` was counted directly against
  production and contains **0 rows**. No cost line is locked, so no lock is
  overridden and none needs releasing. This bullet was written from the COGS-5
  history and the lock-hardening migrations (0012/0016/0030) without checking
  whether the table had any contents; the owner questioned why locks were being
  discussed in a program built on recomputing from source, and was right.
  Phase 5 removes the lock-release step entirely.
- **The rebuild cannot invent missing data.** If purchases are genuinely absent
  (the open Sữa đặc question — no purchase recorded since 2026-05-16), the
  rebuilt figures will reproduce the same negative. The rebuild corrects derived
  layers; only data entry corrects missing sources.

## 5. Phases

Each phase ends in a verifiable state. Phases 1 and 3 can run in parallel; every
later phase is strictly sequential.

### Phase 1 — Guards and instruments (no data changes)

1. Fix `scripts/audit-full-history-recompute.ts:156` so negativity is evaluated
   against every item's theoretical balance, not only mismatched ones. Add a
   regression test that a balanced-but-negative item is reported.
2. Add server-side validation in `savePurchaseOrder`: reject the write when
   `subtotal_amount` differs from the sum of submitted line subtotals. This is
   the guard that would have caught PO-037 at creation.
3. Promote Sonnet's PO header-vs-lines audit to a standing check.

### Phase 2 — Edit a completed purchase order (admin only)

The owner performs the PO-037 correction himself. Deliberately simple, because
the full rebuild in Phase 4 absorbs the consequences:

- Show the edit form for COMPLETED purchase orders to ADMIN only.
- Reuse the existing atomic replace path unchanged
  (`savePurchaseOrderAtomic` with `replaceExisting`), which already deletes the
  PO's lines and `PO_RECEIPT` rows and reinserts them in one transaction.
- Record who edited, when, and the before/after header totals. Purchase orders
  currently have no edit trail; sales orders have `order_events`.
- **No per-line cost impact preview and no lock checking.** Both are unnecessary
  under this program because Phase 4 recomputes everything from source
  immediately afterwards. If this program is ever abandoned mid-way, this
  simplification must be revisited before the feature is considered safe.

The server-side subtotal check from Phase 1 applies to edits too.

### Phase 3 — Backup and a verified restore drill

Take a full backup, then **restore it somewhere and confirm the data is
readable**. This is the one prerequisite that is not negotiable: no backup in
this project has ever been restore-tested, and Phase 4 deletes financial
history. A backup nobody has restored is not a backup.

### Phase 4 — Rebuild stock

1. Owner completes his PO-037 edit (Phase 2).
2. Widen `scripts/apply-full-history-stock-ledger-rebuild.ts` from
   correction-touched orders to **all** orders.
3. Dry run. Owner reviews the summary.
4. Apply. Then `rebuild_inventory_balances()` for the materialized table.
5. Verify with the corrected audit from Phase 1: recorded must equal recomputed
   for every item, and every remaining negative must be listed by name with its
   magnitude.

### Phase 5 — Rebuild COGS

Recompute `cost_at_sale` across all order lines from the rebuilt stock basis,
using the existing cost-correction path. Release `audit_baseline_locks` as a
recorded decision, listing what was released. Produce a before/after P&L
comparison per month for the owner to review before it is considered final.

### Phase 6 — Physical count — DEFERRED TO LAST (owner, 2026-07-30)

The owner counts stock by hand and enters it. This becomes the system's first
real anchor to physical reality and the baseline all future figures are measured
against.

**Owner moved this behind Phase 7 on 2026-07-30:** the stocktake is to be the
final act before expansion begins, not an intermediate checkpoint. Phase 7 now
runs first. Two consequences follow, recorded so they are not discovered later:

1. **The `data_recovery_changes` purge loses its original gate.** The plan was to
   keep the 52,884-row repair log (73% of all rows in the database; the reason
   the daily backup jumped from 31.2 MB to 45 MB on 2026-07-30) until a
   stocktake confirmed the rebuilt figures against physical reality, then purge.
   With the stocktake moved to the end, that gate would hold the log for the
   whole restructure period. It can be purged earlier on a weaker but sufficient
   basis: **Phases 4 and 5 both recompute from source and are re-runnable, so
   the repair log is not the real safety net** — the source data plus a verified
   backup is. Purging costs the ability to reverse a specific run in place, not
   the ability to reach the same state again.
2. **Nothing else in Phase 7 depends on the stocktake.** The restructure touches
   code and documentation, not figures, so the reorder is safe.

### Phase 7 — Repository restructure and documentation cleanup

**Now runs before Phase 6** (owner, 2026-07-30). Still after Phases 4 and 5,
which retire a large amount of code.

**Why the earlier recommendation changes.** On 2026-07-27 a full domain
restructure was advised against: most of the benefit was already banked by
`app/admin/*`, and the cost was import churn across a live selling system. Two
inputs have changed. First, the rebuild retires the entire accumulated
correction layer — `lib/history-ops/`, the `apply-btp-shortfall-*` rounds 1-3,
`apply-fix-double-reversal`, `apply-fix-round2-*`, `apply-fix-round3-*`,
`apply-cogs5-*` and their peers — so a large fraction of what would have been
moved simply gets deleted instead. Second, the owner has explicitly paused
expansion to get this right, which is exactly the window such work needs.

**Hard rule on master data, added 2026-07-30 at the owner's insistence.**

Never delete a row from `Base_Ingredients`, `Semi_Products`, `Products`,
`Product_Variants`, `Recipes`, or `Purchased_Items`, even when it appears
orphaned. Every order line stores a `recipe_snapshot_json` naming the items it
consumed, and the whole rebuild capability rests on being able to resolve those
names years later. A master row that looks unused today becomes an unresolvable
reference the moment any snapshot, backup, or restored database mentions it — and
the failure surfaces during a recovery, which is the worst possible time.

**Retire by marking inactive, never by deleting.** If a name collision is the
problem, rename rather than remove. This rule applies to master data only; the
one-off correction *code* below is a different matter, since git history keeps it.

The owner raised this against a proposed deletion of `BTP-004` "Nước đường".
Checked before acting: 0 order lines reference it in any recipe snapshot, 0
`stock_ledger` rows, 0 received. April and May lines already reference `ING-022`
(the purchased syrup). So that specific deletion would have been safe — but the
rule stands regardless, because "safe this time" is not a method.

Scope:

- **Operating-expense entry screen** (added 2026-07-30, see section 6c): no
  screen currently exists to record a cost like Khoai lang's raw sweet potato —
  a real, recurring operating cost that is deliberately outside the recipe/COGS
  system (non-inventory) but currently has nowhere to be recorded at all, so it
  is invisible in every report.
- Delete the retired one-off correction modules and scripts.
- Add the missing form-field primitives to `components/ui/` (Input, Select,
  Textarea, FormField) and migrate the 17 forms in batches the owner reviews.
  This addresses the 11 competing input styles measured on 2026-07-27.
- Reorganise `lib/` and `components/` along the lines already agreed.
- Documentation: keep the operating rules — `CLAUDE.md`, `docs/COLLABORATION.md`,
  `docs/domain-dictionary.md`, `docs/ROADMAP.md`, `docs/FILE-ORGANIZATION.md`.
  Delete the archaeology — `docs/audits/` (118 files), `docs/handoffs/` (73),
  and superseded plans and specs. Git history preserves every deleted file, so
  nothing is permanently lost and any of it can be recovered on request.

## 6. Non-goals

- No multi-outlet schema work. `ARCH-1`'s design exists but belongs after this.
- No Next.js upgrade.
- No change to the consumption engine, recipe model, or the section 9 rules.
- No attempt to reconstruct purchases that were never entered. If the Sữa đặc
  gap is real, it stays visible in the rebuilt numbers, by design.

## 6b. Closed by the owner, 2026-07-30

**Muối hồng, −14.39 g — closed, not a data defect.** The owner used his own
personal pink salt; it was never purchased for the shop, so no purchase record is
missing. No correction is needed and the negative can be ignored.

**One mechanical consequence remains open.** A recipe still calls for Muối hồng,
so every sale of that drink deducts a little more and the balance keeps drifting
further negative. It will never self-correct. Three ways to settle it, all small,
none urgent: remove it from the recipe if it is not really used; flag it
non-inventory like Nước and Đá viên if it is used but will never be stocked; or
enter a purchase when one actually happens. Worth deciding during Phase 7 rather
than leaving a number that grows quietly wrong.

## 6c. Closed by the owner, 2026-07-30

**Khoai lang (VAR-036) — closed, deliberately non-inventory, not a data defect.**
Its only recipe (`REC-069`, effective since 2026-04-30, still open) has an empty
ingredient list, so none of its 161 sales (all of them, including ones sold
today) have ever deducted stock. The owner's decision: **keep it flagged
non-inventory, do not fill in `REC-069`, do not remove the flag.** The cost of
the raw sweet potato is treated as a daily operating expense, not a
recipe-tracked ingredient.

**One mechanical consequence remains open, and it is bigger than this one
product.** There is currently no screen anywhere in the app to record an
operating expense (raw Khoai lang cost, or anything else in this category), so
this real cost is invisible in every report — it does not appear in COGS, and
it does not appear anywhere else either. It simply does not exist as far as the
system is concerned. **An operating-expense entry screen is needed** — added to
Phase 7's scope below, not urgent but should not be silently dropped either.

## 7. Open items

### 7a. Khoai lang is wired half-way — deliberately parked (owner, 2026-07-30)

The owner created semi-product **Khoai luộc** (`BTP-014`, recipe `RC-032`,
1 raw Khoai lang → 1 Khoai luộc, effective 2026-06-01) on 2026-07-30 at 14:33.
That is **step 1 of 3**, and the chain is not connected:

| | Needed | State |
|---|---|---|
| 1 | Semi-product Khoai luộc has a cooking recipe | **done** — `RC-032` |
| 2 | The sold product Khoai lang consumes it | **missing** — `REC-069` `ingredients_json` is `""` |
| 3 | Raw ingredient Khoai lang is not flagged non-inventory | **still flagged** — `NNL-012.is_non_inventory = TRUE` |

Nothing references `BTP-014`, so **306 servings sold still deduct nothing and cost
nothing** — identical to before the semi-product existed. Step 3 also blocks cost
even if step 2 is completed, because the non-inventory flag suppresses both
deduction and costing.

Asked which way to go, the owner chose **park it and decide later**. Recorded
here because the half-built state is the dangerous one: it *looks* configured. Do
not read `RC-032`'s existence as evidence that Khoai lang is being costed.

Earlier the same day he chose to keep Khoai lang non-inventory and treat the
purchase as a daily operating expense — which needs the operating-expense screen
that does not exist yet (Phase 7). The two decisions point opposite ways; the
next person to touch this should ask rather than infer.

### 7b. Sữa đặc

The Sữa đặc question is unresolved and independent of PO-037: no condensed-milk
purchase has been recorded since 2026-05-16, while sales continued at roughly
1.8 cans per day. Either purchases were made and never entered, or they were
recorded against a different `purchased_item` record than the recipes consume.
Phase 6's physical count will quantify the real gap; the duplicate-item
hypothesis can be tested cheaply at any time and should be, before Phase 4.
