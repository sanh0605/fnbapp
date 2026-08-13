# Plan F — Split `components/POSScreen.tsx`

**Written 2026-08-11 by Opus 5.** Chosen by the owner over the domain
restructure, which stopped at Plan E's E4 decision point. This is the till: the
one screen that takes money every day.

---

## 1. What is actually wrong

`components/POSScreen.tsx` is **1.378 lines in a single component** with **24
`useState` calls** and 7 handlers. Nothing is extracted.

The line count is the symptom. The 24 pieces of state in one scope are the
problem: any change requires holding all of them in mind, and the compiler cannot
tell you which ones a given edit can reach.

**The state clusters cleanly**, which is what makes this tractable:

| Cluster | State vars | Purpose |
|---|---|---|
| **Item configuration** | **5** | `selectedVariant`, `selectedModifiers`, `selectedQty`, `itemDiscount`, `itemDiscountType` |
| Order-level discount | 5 | `promoCodeInput`, `appliedPromoCode`, `manualPromoError`, `userCustomDiscount`, `userCustomDiscountType` |
| Cart | 3 | `cart`, `isCartOpen`, `editingCartIndex` |
| Drafts | 3 | `drafts`, `isDraftModalOpen`, `activeDraftId` |
| Checkout | 3 | `isCheckingOut`, `processingOrder`, `lastCheckoutError` |
| Browsing | 3 | `activeCategory`, `searchQuery`, `selectedProduct` |
| Connectivity | 2 | `isOnline`, `toasts` |

**Correction, 2026-08-13 (Opus 5, before handing F1 over).** The first version of
this table put all ten discount-related state vars in "item configuration" and
called that 10 of 25. Reading the file proves otherwise, and both errors matter:

- The count is **24**, not 25 — `grep -c useState` counts the `import` line.
- The five **order-level** discount vars are not item state. They are passed
  down to `CartPanel` (lines 1098-1107) and are read, backed up and restored by
  `handleConfirmCheckout` (lines 734-738, 770-773, 857-859, 907-909). Extracting
  them **would touch the checkout path**, which rule 3 below forbids. They are
  out of scope for F2, and F1 must not test them through the item modal.

**Item configuration is 5 of 24**, is self-contained, and does not move money:
it decides what one cart line looks like before the line exists. Its code is
the modal JSX at lines **1133-1283** plus `openProductModal` (300),
`addModifier` (323), `removeModifier` (327), `addToCart` (336) and the derived
price block at **381-406**.

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
  current file covering: variant selection changes the displayed total; modifiers
  add their price and the +/- counter tracks repeats; quantity multiplies; item
  discount as a flat amount and as a percent; the **automatic variant promo**
  (lines 392-404: `PERCENT`, `FLAT_PRICE`, and flat-amount each compute
  differently); the `Gốc:` strike-through line appearing only when a discount
  applies; edit mode pre-filling from an existing cart line; and the composition
  of several at once. **Whatever these tests capture becomes the contract** — if
  something looks wrong while writing them, record it, do not fix it.

  Order-level promo code and custom discount are **not** part of this — they
  belong to `CartPanel` and the checkout path (see the correction in §1).

- **F2 — Extract the item-configuration modal** into its own component with the
  5 item state variables moved inside it. Its interface to the parent is two
  things: which product/edit-index opened it, and the configured cart line it
  produces. F1's tests must pass unchanged, with only the import path edited.

- **F3 — Characterise and extract the drafts modal** (3 state vars, JSX at
  1288-1355). Smaller, same shape, and it exercises the pattern a second time.
  Note before starting: `saveDraft` and `deleteDraft` are also called from the
  checkout path, so F3 extracts the **modal**, not the draft handlers.

- **F4 — Measure and decide, as E4 did.** Honest arithmetic, not the earlier
  guess: the item modal is ~150 JSX lines plus ~80 of handlers and derived
  price, and the drafts modal ~70. F2 should land the file near **1.150** and F3
  near **1.050-1.100** — not the 700-800 first written here, which was an
  estimate made without measuring. **That is fine, and it is the point:** if a
  change to item configuration no longer requires reading the whole file, the
  goal is met. **Stop there.** Do not keep cutting toward a line count for its
  own sake, and do not let a disappointing number become the reason to start
  touching checkout.

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
