# Design Spec: Inventory Transparency (Owner-Verifiable Stock Numbers)

Status: proposed, awaiting owner approval
Author: Claude Opus 5 (design only)
Implementer: Claude Sonnet 5
Date: 2026-07-27

## 1. Problem

The owner reports that inventory numbers do not match reality and that he cannot
tell where any number comes from, so his confidence in the whole system is
eroding rather than improving over time.

Investigation on 2026-07-27 found this is not a data-quality problem. It is a
structural gap with three parts.

### 1.1 The app holds two different stock numbers and shows the owner the weaker one

| | What the owner sees | The trustworthy number |
|---|---|---|
| Source | Stored rows in `stock_ledger` / `inventory_balances` | `lib/full-history-recompute.ts` — replays purchases + sales + recipes + physical counts from scratch |
| Trust level | Derived. `CLAUDE.md` section 9 states this layer must not be trusted when recomputing | The layer that exists specifically to second-guess the stored ledger |
| Reachable from the UI | Yes | **No** |

`full-history-recompute.ts` is imported only by `scripts/` (10 command-line
tools) plus `lib/order-ledger-audit.ts` and `lib/reorder-suggestion.ts`. No
route, page, or server action exposes it. When an agent runs an audit and
reports "0 mismatches", the owner has no way to confirm that independently.

### 1.2 The existing history view cannot explain a number

`components/StockLedgerHistoryButton.tsx` (97 lines) renders four columns:
Ngày, Loại biến động, Thay đổi, Ghi chú. It is missing:

- **A running balance column.** Only the per-row delta is shown, never the
  balance after each row. Scanning down a ledger to find the first row where the
  balance goes wrong is the only practical way to locate a bookkeeping error,
  and this view makes it impossible.
- **Business-language events with drill-through.** Rows show machine transaction
  types, not "sold 3 milk teas at 09:05, order ABC", and cannot be clicked back
  to the originating order or purchase.
- **A trustworthy source.** It reads the derived ledger — the layer that is
  explicitly not to be trusted.

### 1.3 Negative stock is provably a system fault, never a real-world one

The owner records every purchase and every sale but deliberately does **not**
record waste, spillage, or spoilage. Unrecorded consumption can only push
computed stock **above** physical stock. Therefore any negative computed balance
is, by construction, caused by missing/mistimed input data or over-large
computed consumption. It can never be explained by real-world leakage.

This makes negative balances a reliable defect detector, and the system
currently does nothing with that signal.

**Ruled out: missing opening balance.** The system has no opening-balance concept
(a search across all migrations and all of `lib/`, `app/`, `components/` for
`opening_balance`, `initial_stock`, `OPENING`, `INITIAL_STOCK` returns zero
results), so the recompute engine starts every ingredient at zero. The owner
confirmed on 2026-07-27 that purchase orders were entered from the very first
purchase — made to test recipes, before any selling began — so there was no
pre-system stock. **A zero start is therefore correct, and this is not the
cause.**

**Primary candidate: unvalidated semi-product batch yield.** In
`lib/inventory-consumption.ts`, when a sale needs a semi-product that is not in
stock, implicit production consumes raw ingredients as:

```
consumed = (cooking_recipe_quantity / batch_yield) * shortfall_quantity
```

`batch_yield` comes from `semi_products.batch_yield`, declared in migration 0001
as `numeric not null default 1`. Two failure modes, both silent:

1. **Unit mismatch.** `batch_yield` carries no unit and is not constrained to
   agree with the unit in which drink recipes consume the semi-product. A tea
   base whose cooking recipe is "40g leaf yields 2000ml" must have
   `batch_yield = 2000` if drink recipes consume it in ml. Entered as `2`
   (thinking in litres), every consumption over-consumes raw ingredients by
   1000x. Nothing validates this.
2. **Never configured.** The column defaults to `1`, and
   `lib/inventory-consumption.ts:205` applies a further `|| 1` fallback. A
   semi-product whose yield was never set consumes its entire cooking recipe for
   each single unit consumed.

This fits every reported symptom: purchases and sales complete, waste
deliberately unrecorded (which can only inflate stock), yet balances go deeply
negative, and COGS is inflated in step because over-consumption is priced.

It also compounds. At `lib/inventory-consumption.ts:88` available semi-product
stock is clamped with `Math.max(0, ...)`, so once a semi-product balance is
negative every subsequent sale is treated as a full shortfall and re-explodes
the entire cooking recipe.

By contrast the purchase side validates strictly:
`lib/purchase-ledger-rebuild.ts:resolveConversion` throws on a missing,
mismatched, or ambiguous unit conversion. The rigour is asymmetric, and the lax
side is the one producing wrong numbers.

Three secondary candidates, requiring live data to confirm or dismiss:

| # | Cause | Signature in the data |
|---|---|---|
| 2 | Purchase order dated on the day it was entered rather than the day goods arrived | Balance dips negative, then recovers on the entry date |
| 3 | Drink-recipe quantity recorded in a different unit than the ingredient's stock unit | Implausibly large negative magnitude on a directly-consumed ingredient |
| 4 | Duplicate item records — purchased under one id, consumed under another | One id permanently positive, its twin permanently negative |

## 2. Goals

1. The owner can open any ingredient and follow the full arithmetic from the
   start of history to today's balance, with a running balance on every row.
2. The owner can run the trustworthy recompute himself, on demand, and see where
   and by how much the stored numbers disagree with it.
3. Every negative balance is automatically classified against the five causes in
   1.3, so the owner is told *why*, not merely *that*, a number is wrong.

## 3. Non-goals

- **No writes.** Phase 0 and both features are strictly read-only. Nothing in
  this spec modifies `stock_ledger`, `inventory_balances`, orders, purchases,
  recipes, or `semi_products`.
- **No correction of whatever Phase 0 finds.** If a batch yield is wrong,
  changing it re-prices history and moves every dependent number. That is a
  separate spec with its own owner approval and its own rollback plan.
- **No cut-off / stock reset.** Deferred, and sequenced after this work so the
  owner can understand and trust the baseline he is setting.
- No changes to the consumption engine, MAC costing, or recipe model.

## 4. Feature 1 — "Vì sao còn bấy nhiêu" (per-ingredient explanation)

### 4.1 Entry point

Extend the existing history affordance in `components/StockTable.tsx` rather
than adding a new navigation entry. `StockLedgerHistoryButton` is replaced by a
fuller view; the button's placement and label stay as they are.

### 4.2 Content

A chronological table for one ingredient, oldest first, covering all history:

| Column | Content |
|---|---|
| Ngày | Event timestamp |
| Diễn giải | Business language, not transaction codes. "Nhập 10kg từ NCC Minh Phát", "Bán 3 ly Trà sữa trân châu", "Nấu Hồng trà (tự động)", "Đếm tay điều chỉnh" |
| Vào | Quantity in, blank if none |
| Ra | Quantity out, blank if none |
| Còn lại | **Running balance after this row** |
| Nguồn | Link to the originating order or purchase order |

Rows where the running balance is negative are visually marked. The first row
that turns the balance negative is marked distinctly — that row is the defect
location in the great majority of cases.

### 4.3 Data source

Computed by `full-history-recompute.ts`, not read from `stock_ledger`. The point
of the screen is to show the trustworthy number; sourcing it from the derived
ledger would reproduce the existing problem.

Where the recomputed row set and the stored ledger disagree, the screen shows
the recomputed value and flags the divergence inline. It does not silently pick
one.

### 4.4 Performance

Full-history recompute over all orders is not viable on every page view. The
view computes for a single ingredient and caches the result per ingredient with
explicit invalidation on any inventory mutation, following the existing
`unstable_cache` + `revalidateTag` pattern already used in `lib/sheets_db.ts`.
If single-ingredient recompute still exceeds roughly two seconds at current data
volume, fall back to computing on demand behind an explicit "Tính lại" action
rather than degrading the page load.

## 5. Feature 2 — Owner-run reconciliation

### 5.1 Placement

A new screen under `app/admin/audit/`, which already exists as the home for
audit surfaces (`app/admin/audit/backdated-ledger/`).

### 5.2 Behaviour

A single primary action, "Đối chiếu lại từ đầu", which runs
`full-history-recompute.ts` read-only and renders:

**Summary band.** Number of ingredients checked, number matching, number
diverging, number negative.

**Divergence table.** One row per ingredient where stored and recomputed
balances differ: ingredient name, stored balance, recomputed balance,
difference, and a link into Feature 1 for that ingredient.

**Negative-cause table.** One row per ingredient with a negative recomputed
balance, carrying an automatic classification against section 1.3:

| Verdict | Rule |
|---|---|
| Nghi sai định mức mẻ | Negatives arise only through implicit-production paths, and the ratio of consumed-to-purchased quantity is a near power of ten |
| Nghi định mức mẻ chưa khai | The semi-product feeding this ingredient has `batch_yield` of exactly 1 while its cooking recipe yields a quantity plainly larger than 1 |
| Đơn nhập ghi trễ | Balance recovers to non-negative after a later purchase whose recorded date follows the negative window |
| Nghi sai đơn vị công thức | Ingredient is consumed directly (no semi-product in the path) and negative magnitude exceeds total purchased quantity by 100x or more |
| Nghi khai trùng nguyên liệu | Another ingredient with a similar name holds a persistently unconsumed positive balance |
| Chưa phân loại | None of the above matched |

Classification is advisory and labelled as such in the UI. It narrows where to
look; it does not assert a conclusion. Ingredients falling into "Chưa phân loại"
are listed first, since they are the ones needing human judgement.

### 5.3 Access and safety

- Restricted to ADMIN.
- Read-only. The screen must not offer any corrective action; fixing whatever it
  finds is separate, deliberate work under its own approval.
- Because the run is read-only, it is safe to invoke repeatedly. The UI should
  say so plainly, so the owner is not afraid to press the button.

## 6. Testing

Both features are read paths over an engine that already carries tests
(`lib/full-history-recompute.test.ts`), so testing concentrates on the new
logic rather than re-testing the engine.

- Unit tests for the running-balance projection: a fixture sequence of
  purchases, sales, implicit production, and adjustments yields the expected
  balance after each row.
- Unit tests for each of the six classification verdicts in 5.2, one fixture per
  rule, plus a fixture that must land in "Chưa phân loại".
- A test asserting neither feature performs a write: the reconciliation path is
  exercised against a mocked client that fails the test on any insert, update,
  upsert, or delete.
- Existing suite must stay green (804 tests as of 2026-07-29).

## 7. Sequencing and handoff

0. **Phase 0 — confirm or kill the batch-yield hypothesis before building
   anything.** A read-only diagnostic (a `scripts/` tool, not a UI) that, for
   every semi-product, prints: its `batch_yield`, the unit its cooking recipe is
   written in, the unit every drink recipe consumes it in, and the implied
   raw-ingredient consumption per unit sold. Any semi-product whose implied
   consumption is off by a power of ten, or whose `batch_yield` is exactly 1
   while its cooking recipe plainly yields more, is a hit.

   This is a few hours of work and it determines everything after it. If the
   hypothesis holds, the fix may be a handful of corrected yield values plus a
   validation rule, and Features 1 and 2 become verification and prevention
   rather than investigation. If it fails, Feature 2's classifier is the fallback
   route to the real cause. Do not start Feature 1 before Phase 0 reports.

1. Feature 1, then Feature 2. Feature 1 establishes the recompute-backed
   read path that Feature 2's drill-through links into.
2. Owner reviews Feature 1 on real data before Feature 2 starts. The point of
   this work is the owner's confidence, so his reading of the first screen is
   the acceptance test for the second.
3. Once Feature 2 has run against live data, its output sizes the opening-balance
   work, which is specced separately.

Implementation is assigned to Claude Sonnet 5 per the standing agent split.
Verification bar per `CLAUDE.md`: `tsc` clean, full suite green, `next build`
passes, and owner sign-off on each screen against live data.

## 8. Follow-on work this spec deliberately does not cover

**Validation on `batch_yield`.** Whatever Phase 0 finds, the absence of any
constraint tying a semi-product's batch yield to the unit its consumers use is a
defect in its own right. A yield entered in the wrong unit currently produces a
silently wrong number instead of an error, while the purchase side throws on the
equivalent mistake. Closing that asymmetry is the durable fix and belongs in the
correction spec that follows Phase 0.

**Correcting historical numbers.** If yields were wrong, every historical
consumption row and every COGS figure derived from them is wrong too. Recomputing
them is well-supported by the existing engine but it rewrites the financial
record, so it needs its own spec, its own owner approval, and a verified
rollback path.
