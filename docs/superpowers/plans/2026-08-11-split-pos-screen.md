# Plan F — Split `components/POSScreen.tsx`

**Written 2026-08-11 by Opus 5.** Chosen by the owner over the domain
restructure, which stopped at Plan E's E4 decision point. This is the till: the
one screen that takes money every day.

---

## 1. What is actually wrong

`components/POSScreen.tsx` is **1.378 lines in a single component** with **25
`useState` calls** and 7 handlers. Nothing is extracted.

The line count is the symptom. The 25 pieces of state in one scope are the
problem: any change requires holding all of them in mind, and the compiler cannot
tell you which ones a given edit can reach.

**The state clusters cleanly**, which is what makes this tractable:

| Cluster | State vars | Purpose |
|---|---|---|
| **Item configuration** | **10** | variant, modifiers, quantity, item discount + type, promo code, applied promo, promo error, custom discount + type |
| Cart | 3 | `cart`, `isCartOpen`, `editingCartIndex` |
| Drafts | 3 | `drafts`, `isDraftModalOpen`, `activeDraftId` |
| Checkout | 3 | `isCheckingOut`, `processingOrder`, `lastCheckoutError` |
| Browsing | 3 | `activeCategory`, `searchQuery`, `selectedProduct` |
| Connectivity | 2 | `isOnline`, `toasts` |

**Item configuration is 10 of 25** and is self-contained: it decides what one
cart line looks like before the line exists. It does not move money.

---

## 2. This is testable, and the belief that it was not is a correction worth recording

`jsdom` is in `package.json`, `vitest.config.ts` includes
`components/**/*.test.tsx`, and **two component tests already render for real** —
`components/ui/Dialog.test.tsx` and `components/DialogHost.test.tsx`, using
`createRoot` + `act` with a per-file `// @vitest-environment jsdom`. No
testing-library needed; the pattern is already in the repo.

**During Plan D (D6, 2026-08-08) this was believed absent.** The stocktake and
issue-slip components were therefore tested by asserting against *source text*
rather than rendered output — a much weaker check that cannot see a broken
render. Those tests should be revisited once this plan proves the pattern; not
here, and noted in `docs/OPEN-ITEMS.md` rather than silently expanded into.

This changes the safety of the whole plan. A refactor of the till with no
automated verification would rest entirely on the owner ringing test sales. With
render tests it rests on **characterisation**: capture the current behaviour
first, then move code, and let the tests prove nothing changed.

---

## 3. Rules

1. **Tests before moves, every time.** For each extraction, the characterisation
   tests are written and passing **against the current unsplit file** first. A
   test written after the move only proves the new code is self-consistent.
2. **Behaviour-preserving only.** No fixes, no improvements, no "while I'm here".
   If a bug is found, record it and leave it — a bug fixed inside a refactor is
   invisible in the diff.
3. **The checkout path is not touched** unless a later step proves it necessary.
   `isCheckingOut`, `processingOrder`, `lastCheckoutError` and everything they
   reach stay where they are. That is where money moves, and reducing line count
   is not worth touching it.
4. **Each step ships alone**, small enough that the owner can verify it by
   ringing one real sale and voiding it, with rollback one command away.

---

## 4. Tasks

- **F1 — Characterise the item-configuration modal.** Render tests against the
  current file covering: variant selection changes price; modifiers add; quantity
  multiplies; item discount as amount and as percent; promo code accepted;
  promo code rejected with its message; custom discount; and the composition of
  several at once. **Whatever these tests capture becomes the contract** — if
  something looks wrong while writing them, record it, do not fix it.

- **F2 — Extract the item-configuration modal** into its own component with the
  10 state variables moved inside it. Its interface to the parent is one thing:
  the configured cart line it produces. F1's tests must pass unchanged, with only
  the import path edited.

- **F3 — Characterise and extract the drafts modal** (3 state vars). Smaller,
  same shape, and it exercises the pattern a second time.

- **F4 — Measure and decide, as E4 did.** After F2 and F3 the file should be
  around 700–800 lines. If that is workable, **stop.** Do not continue to a line
  count for its own sake — the goal was that a change to the till no longer
  requires reading everything, not a particular number.

---

## 5. Verification bar

`CLAUDE.md` section 9 in full, plus:

- **F1's tests pass before and after F2, with no edit except the import path.**
  Any other change to them means behaviour moved.
- `npx vitest run` count must **rise** in F1 and F3 (new tests) and stay
  **identical** across F2 (pure move).
- The owner rings **one real sale on the deployed till and voids it**, checking
  the configuration modal specifically: a drink with a variant, a modifier, a
  quantity above one, and a discount. A voided order does not enter revenue
  (`findCompletedOrders` takes `COMPLETED` only), so the books stay clean.
- Rollback deployment recorded **before** the deploy, and it must be a
  known-good one — not merely the previous one.

---

## 6. Out of scope

The domain restructure (closed at E4). Revenue audit (item 35). Financial report
(item 31). Re-doing Plan D's source-text component tests as render tests —
recorded in `docs/OPEN-ITEMS.md`, not done here.
