# Plan I — Final evaluation: did any of this help, and does it generalise?

**Written 2026-08-17 by Opus 5**, at the owner's request, as the **last** step
after the outstanding backlog is cleared. Recorded now so the questions survive
the work that comes before them.

The owner's four questions, verbatim in intent:

1. How much better and more efficient is the POS after the split?
2. Can it be reduced further?
3. Can the same treatment be applied to every other file?
4. If yes, plan it — and treat this as the final assessment of everything done.

---

## 1. The distinction this evaluation must not blur

**Plan F did not make the POS faster. It made it safer to change.** Those are
different claims and the evaluation has to report them separately, because
"rút gọn code" naturally sounds like "runs faster" and here it does not.

Evidence already in hand, measured 2026-08-17 after F3 landed:

| | Before Plan F | After |
|---|---:|---:|
| `components/POSScreen.tsx` | 1.378 lines | **1.136** |
| `useState` in that file | 24 | **19** |
| Automated tests covering the POS | **0** | **19** |
| `/pos` bundle | 21,8 kB page / 118 kB first load | **21,8 kB / 118 kB** |

**The bundle did not move.** Total lines across the POS files went *up* — 242
removed from one file, 327 added across two new ones. Nothing was deleted;
code was relocated and its state was given a smaller scope.

So the honest headline is: **a change to item configuration now touches a
258-line file with 14 tests around it instead of a 1.378-line file with none.**
Any claim beyond that needs its own measurement.

---

## 2. Question 1 — what to measure, beyond what is above

- **Speed** is a separate exercise (§4) and its result belongs here, not in the
  refactor's ledger. The data layer is already measured: five full-table
  fetches ~110 ms warm / 1.288 ms cold, best-sellers ~250 ms warm / 868 ms
  cold, 26,6 KB shipped. **Data is not the bottleneck.** Unmeasured: server
  render time, browser startup for 118 kB, and every in-screen interaction.
- **Defect rate** is the honest measure of a maintainability refactor, and one
  data point exists: F2 introduced a real regression (the modal keeping the
  previous drink's configuration) that F1's tests did not catch and a
  measurement did. Record that against the benefit, not separately from it.

## 3. Question 2 — can it be reduced further

**Answered already, in `2026-08-11-split-pos-screen.md` §4b: no, not without
touching checkout.** All 19 remaining state variables are the checkout path or
are read by it. Re-state the finding here; do not re-derive it.

## 4. Question 3 — does it generalise

**The thing to generalise is not "split big files".** Plan F worked because of
a specific combination: many pieces of entangled state in one scope, **zero
tests**, and a clean seam that did not cross the money path. A long file with
tidy structure gains nothing from being cut, and cutting costs net lines.

So the evaluation must first **measure the candidates rather than assume
them**:

- A census of file sizes across `app/` and `components/`, with, for each large
  file: how many `useState`, whether any test renders it, and whether it
  touches money.
- Rank by **(entangled state × absence of tests)**, not by line count.
- The most likely honest outcome is a **short list, not a programme** — and
  possibly the finding that the highest-value work is adding render tests to
  screens that have none (`OPEN-ITEMS 38`), with no splitting at all.

## 5. Question 4 — the assessment itself

Cover, with numbers and with what each number does **not** show:

- Plans C through H: what each set out to do, what it actually changed, and
  which of its stated concerns dissolved under measurement. Plan H is the
  cautionary case — **one real finding, three phantoms of the planner's own
  making** (`2026-08-14-revenue-audit.md` §4).
- The defects that reached production during this period and what caught each
  one: the stocktake page that threw on every load (caught by the owner, not
  by four green gates), the Drive backup broken by a second copy of a table
  list, the F2 keyboard regression (caught by a measurement before deploy).
- What is measurably better: 19 POS tests where there were none, a re-runnable
  revenue audit, a costing error of 7,4% found and fixed, a first stocktake
  reconciling to the dong.
- What is not: 1.136 lines is still not comfortable, the checkout path is
  untouched, and 44.229.000đ of early revenue is permanently unverifiable.

---

## 6. Rule for this plan

Every claim carries its measurement or is not made. This is an assessment of
work whose recurring failure was confident statements that measurement later
deflated — an assessment that repeats that failure would be worse than none.
