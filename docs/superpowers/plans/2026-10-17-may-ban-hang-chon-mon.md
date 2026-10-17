# Máy bán hàng: chọn đủ món rồi mới vào giỏ — kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a dish opens its choices, and nothing enters the cart until Thêm. Identical lines merge. The cart has one Thanh toán button, followed by a method step.

**Architecture:**
- Pure cart logic: a merge-or-append function in `cart-pricing.ts` and a pick sorter in `option-groups.ts`, both unit-tested.
- The till UI is rebuilt from the approved mockups BF and PF. On a screen 768 px or wider the picker sits inline; on a narrower screen it is a bottom sheet. The cart's pay area becomes a two-step flow, with the step state lifted to `POSScreen`.
- The report allocator stops listing 0đ options.
- A one-transaction SQL script creates Độ ngọt and Đá. By default it only does a dry run.

**Tech Stack:** Next.js 16 App Router, React, Tailwind 3.4, Vitest + Testing Library, Supabase CLI (`db query`).

**Spec:** `docs/superpowers/specs/2026-10-17-may-ban-hang-chon-mon-design.md`. Rules: `BR-SALE-019`, `BR-SALE-020` in `docs/02-rules/business-rules/till.md`. Mockups: boards BF (computer), PF (phone) and B2 (method step) of https://claude.ai/artifact/DEbZg7kdYiKDwc2rvWKaNW. Their HTML is copied to `.mockups/` in the worktree for Gemini. That folder is not committed.

**Order:** Tasks 1–3 (backend, one `backend-coder` run). Then 4a → 4b → 5a → 5b → 6 → 7, strictly in sequence: Tasks 4 and 5 both edit `POSScreen.tsx`, and Task 4 removes `addQuickLine` from the Task 1 file. Branch `feat/pos-pick`, worktree `.worktrees/pos-pick`.

## Hiện trạng

The spec answers the five questions in section 1. This list adds what the plan needs.

1. **States.**
   - **Picker**: closed, open to add, or open to edit a cart line.
     - `selectedProduct` sets the open state.
     - Today `editingCartIndex` (an index) marks the line being edited. This plan replaces it with `editingLineId` (the line's id), because the inline picker no longer blocks the cart. While the line is being edited, the cashier can now remove it, clear the cart or load a draft.
     - If the line is gone when Cập nhật is tapped, the picker closes and the cart stays as it is.
     - The picker also closes when checkout starts.
   - **Cart**: order view, method step, sending (`processingOrder`; the cart empties at once, as today), or failed with "Gửi lại".
     - The method step is a boolean `isPayStepOpen` held in `POSScreen` and passed to `CartPanel`.
     - It goes false on any `cart` change: send start, clear, add, edit, a quantity change or a draft load.
2. **Buttons.**
   - **Picker**:
     - **−/+**: changes the quantity, from 1 to 99. − is disabled at 1 and + at 99.
     - **Bỏ** (computer) / **✕** (phone): closes the picker with no change, when adding and when editing.
     - **"Thêm vào đơn · <tiền>"**: adds the dish. When editing, it reads "Cập nhật · <tiền>".
     - **"Giảm giá món"**: a disclosure that opens the discount fields.
   - **Cart**:
     - **Thanh toán**: opens the method step. It is disabled when offline, when the cart is empty, or while sending.
   - **Method step**:
     - **Tiền mặt**: pays cash.
     - **Chuyển khoản**: pays by transfer.
     - **Chia tiền mặt + chuyển khoản**: opens the existing split popup.
     - **‹ Quay lại đơn**: goes back to the order view.
   - The size buttons on the dish card are removed. One-tap is reversed by `BR-SALE-019`, so its tests go too (the reason is recorded in each commit).
3. **Lists.**
   - **Picker groups**: Cỡ ly first, then the dish's ACTIVE groups that have at least one ACTIVE option, in group sort order (`optionGroupsForProduct`, unchanged).
     - INACTIVE options and empty groups are left out, as today.
     - Options keep load order. The table loader orders them by id, so MOD-011…017 come in the intended order.
     - A picked option that is no longer active still shows as a row under "Đã chọn trước", so an old line can be edited.
   - **Sizes** are sorted by list price (`variant.price`), cheapest first. The cheapest is lit when the picker opens. The card shows a list-price range.
   - **Topping report**: 0đ options are left out. They have no revenue, and they are choices, not toppings.
4. **Inputs.**
   - **Quantity**: 1–99, set only with −/+.
   - **Item discount**: a text box with `inputMode="numeric"`, digits only, clamped by `clampDiscount` (0 to the line total in VND, 0–100 in %).
5. **Data.**
   - In scope: cart lines in the browser, drafts, and the stored `order_lines_v2.modifiers_snapshot_json`, whose shape is unchanged.
   - Out of scope: stock and cost. The till deducts nothing.

Extra questions for this job:

6. **What breaks if the merge is wrong?**
   - Without an item discount, nothing in the money: `priceCart` charges `qty × (size + options)`, so two lines of one cup cost the same as one line of two.
   - With an item discount, the money changes. A VND item discount is an amount for the whole line (`lib/sales/price-cart.ts:105`). So a line with an item discount never merges (Task 1 test).
7. **What does Enter do in each state?** This is pinned in Task 5.
   - Order view with lines: Enter opens the method step.
   - Method step open: the handler does nothing, and the focused button acts natively. Focus starts on Tiền mặt.
   - A held key (`e.repeat`) does nothing.

Đã xem:
- `POSScreen.tsx`: layout, add handlers, Enter handler, `handleConfirmCheckout` clearing the cart at send start;
- `ItemConfigModal.tsx`, `CartPanel.tsx` (pay area, phone bar), `ProductCard.tsx`;
- `cart-pricing.ts` and its tests;
- `option-groups.ts`, `OptionGroupPicker.tsx`;
- `lib/sales/price-cart.ts:95-110`;
- `report-v2-allocators.ts` and its tests;
- migration `0119_modifier_groups.sql` (name index, id style);
- `scripts/move-capital-entries-to-acb.ts`.

Sonnet's critique also read:
- `ProductGrid.tsx`: the phone today is a 2-column card grid; a fragment holds search, tabs and grid;
- `CartItemRow.tsx`: the only place that starts an edit;
- `components/ui/phone-size.guard.test.ts`.

Chưa xem: the bodies of `POSScreen.c2/c6/c7/date/draftsModal` tests (a grep found no pay-button or size-button text in them), and `resolvePosCheckoutAttempt`.

## Ví dụ số thật

Prices on 2026-10-17: Cà phê đá 360ml is 15.000đ, 500ml is 18.000đ, and Kem muối is 4.000đ.

| Bước | Giỏ |
|---|---|
| Thêm 2 × 360ml · Ít ngọt · Ít đá · Kem muối | dòng 1: 2 × 19.000 = 38.000 |
| Thêm 1 × 360ml · Không đường · Ít đá · Kem muối | dòng 2: 1 × 19.000 = 19.000 |
| Thêm 1 × 360ml · Kem muối · Ít đá · Ít ngọt (bấm khác thứ tự) | dòng 1 thành 3 × 19.000 = 57.000 |
| Tổng | 76.000đ, 2 dòng |
| Thêm 1 × 360ml · Ít ngọt · Ít đá · Kem muối, giảm 2.000đ | dòng 3 riêng: 19.000 − 2.000 = 17.000; tổng 93.000đ |

**Topping report example.** Order line `ol-migrated-f1af7463-6986-4c86-a6f3-7ef07fa7f3a4` is Cà phê đá 500ml at 21.000đ with 20ml cốt cà phê at 3.000đ, so 24.000đ. Suppose it also carried "Ít đá" at 0đ:
- `breakdownRevenueByProduct` still returns 2 rows: the dish at 21.000 and `MOD:MOD-001` at 3.000;
- the line's revenue stays 24.000đ.

On 2026-10-17, 0 of the 4.960 order lines stored a 0đ option (read-only query), so today's reports do not change.

## Global Constraints

- Code and comments in English; on-screen text in Vietnamese.
- Ponytail at full: no extra code, no new library, no Lodash.
- Every UI change ships two layouts:
  - phone, narrower than 768 px;
  - computer/tablet, 768 px and wider. The left category rail appears only from 1024 px.
- Sizes from BF and PF.
  - Computer: card name 18 px, price 17 px. Option rows 46 px with 16 px text.
  - Phone: dish rows 64 px with 18 px names. Option rows 54 px with 18 px text and 26 px marks. Quantity stepper 60 px.
  - Cart: line names 17 px, sub-lines 15 px, total 26 px, Thanh toán 64 px.
- Every picker group is its own framed block, with a tinted header band and a numbered circle.
- A default option is never stored (`pickOne`). The cart line shows only what differs from the defaults.
- No server action or SQL writer changes in Tasks 1, 4 and 5. The till must keep taking orders.
- `npm run build` runs in a throwaway worktree, never while 8386 is up.

## Review Focus

1. A line is removed while it is being edited, then Cập nhật is tapped: no crash, cart unchanged. Test in Task 4.
2. Enter is held down in the order view: the step opens and nothing is paid. Test in Task 5.
3. The same choices are tapped in a different order: one merged line. Test in Task 1.
4. Two equal lines both carry a 2.000đ item discount: two lines, 4.000đ off in all. Test in Task 1.
5. The till goes offline while the method step is open: Tiền mặt and Chuyển khoản are disabled. Test in Task 5.

---

### Task 1: Merge identical lines, sort picks (backend-coder)

**Files:**
- Modify: `app/pos/components/cart-pricing.ts`, which gains `addOrMergeLine`
- Modify: `lib/sales/option-groups.ts`, which gains `orderPicks`
- Test: `app/pos/components/cart-pricing.test.ts`, and `lib/sales/option-groups.test.ts` (create it if it does not exist)

**Interfaces:**

`addOrMergeLine(cart: any[], line: any): any[]`
- If the cart already holds an identical line, returns the cart with that line's `qty += line.qty`.
- Otherwise appends `{ ...line, id: crypto.randomUUID() }`.
- Identical means all of these match: `variant_id`, `unit_price`, the sorted list of option ids, and an item discount of 0 on both lines.

`orderPicks(picks: Pick[], groups: ProductOptionGroup[]): Pick[]`
- Sorts picks by group position, then by option position within the group.
- Picks that are in no group go to the end in their original order.

- [ ] **Step 1: Write the failing tests.** Use made-up ids so nobody takes them for real data.

```ts
describe("addOrMergeLine", () => {
  const sweet = { id: "opt-it-ngot", name: "Ít ngọt", price: 0 };
  const ice = { id: "opt-it-da", name: "Ít đá", price: 0 };
  const cream = { id: "opt-kem-muoi", name: "Kem muối", price: 4000 };
  const base = { product_id: "p-cfd", product_name: "Cà phê đá", variant_id: "v-360", size_name: "360ml",
    unit_price: 15000, qty: 2, discount_amount: 0, discount_type: "VND", modifiers: [sweet, ice, cream] };

  it("appends a line with a fresh id to an empty cart", () => {
    const cart = addOrMergeLine([], base);
    expect(cart).toHaveLength(1);
    expect(typeof cart[0].id).toBe("string");
    expect(cart[0].qty).toBe(2);
  });
  it("merges the same choices tapped in another order", () => {
    const cart = addOrMergeLine(addOrMergeLine([], base), { ...base, qty: 1, modifiers: [cream, ice, sweet] });
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(3);
  });
  it("keeps a separate line when one option differs", () => {
    const none = { id: "opt-khong-duong", name: "Không đường", price: 0 };
    expect(addOrMergeLine(addOrMergeLine([], base), { ...base, qty: 1, modifiers: [none, ice, cream] })).toHaveLength(2);
  });
  it("counts portions: one Kem muối is not two", () => {
    expect(addOrMergeLine(addOrMergeLine([], base), { ...base, modifiers: [sweet, ice, cream, cream] })).toHaveLength(2);
  });
  it("keeps a separate line for another size", () => {
    expect(addOrMergeLine(addOrMergeLine([], base), { ...base, variant_id: "v-500", unit_price: 18000 })).toHaveLength(2);
  });
  it("keeps a separate line when the unit price differs (old draft)", () => {
    expect(addOrMergeLine(addOrMergeLine([], base), { ...base, unit_price: 14000 })).toHaveLength(2);
  });
  it("never merges lines that carry an item discount, so each keeps its own 2.000đ off", () => {
    const off = { ...base, qty: 1, discount_amount: 2000 };
    const cart = addOrMergeLine(addOrMergeLine([], off), off);
    expect(cart).toHaveLength(2);
    expect(cart.map((l: any) => l.qty)).toEqual([1, 1]);
  });
  it("does not merge a plain line into a discounted one", () => {
    expect(addOrMergeLine(addOrMergeLine([], { ...base, discount_amount: 2000 }), base)).toHaveLength(2);
  });
  it("does not mutate the input", () => {
    const input = addOrMergeLine([], base);
    const snapshot = JSON.stringify(input);
    addOrMergeLine(input, base);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
```

`orderPicks` tests. Build two groups:
- group 1: options [Bình thường, Ít ngọt, Không đường];
- group 2: options [Caramel, Kem muối].

Expect:
- picks [Kem muối, Ít ngọt, Caramel] come back as [Ít ngọt, Caramel, Kem muối];
- a pick with an unknown id comes last, and two unknown picks keep their order;
- the input array is not mutated.

- [ ] **Step 2: Run the tests and expect FAIL** (the exports are missing): `npx vitest run app/pos/components/cart-pricing.test.ts lib/sales/option-groups.test.ts`

- [ ] **Step 3: Implement**

```ts
// cart-pricing.ts
const optionKey = (l: any) => l.modifiers.map((m: any) => m.id).sort().join("|");
// An item discount is an amount for the whole line (price-cart.ts), so discounted lines never merge.
const sameLine = (a: any, b: any) =>
  a.variant_id === b.variant_id && Number(a.unit_price) === Number(b.unit_price) &&
  !Number(a.discount_amount) && !Number(b.discount_amount) && optionKey(a) === optionKey(b);

// BR-SALE-019: an identical line gains the quantity; otherwise the line is appended.
export function addOrMergeLine(cart: any[], line: any): any[] {
  const i = cart.findIndex((l) => sameLine(l, line));
  if (i >= 0) return cart.map((l, j) => (j === i ? { ...l, qty: l.qty + line.qty } : l));
  return [...cart, { ...line, id: crypto.randomUUID() }];
}
```

```ts
// option-groups.ts
export function orderPicks(picks: Pick[], groups: ProductOptionGroup[]): Pick[] {
  const pos = new Map<string, [number, number]>();
  groups.forEach((g, gi) => g.options.forEach((o, oi) => pos.set(o.id, [gi, oi])));
  const end: [number, number] = [Infinity, 0];
  return [...picks].sort((a, b) => {
    const [ga, oa] = pos.get(a.id) ?? end;
    const [gb, ob] = pos.get(b.id) ?? end;
    return ga - gb || oa - ob;
  });
}
```

- [ ] **Step 4: Run the same command and expect PASS.** Then run `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(pos): identical cart lines merge, discounted lines stay apart, picks sort by group (BR-SALE-019)`.

### Task 2: Leave 0đ options out of the revenue breakdown (backend-coder)

**Files:** Modify `lib/reports/report-v2-allocators.ts:55-70`. Test `lib/reports/report-v2-allocators.test.ts`.

- [ ] **Step 1: Write the failing test.** Build one order and one line in the fixture shape used in that file:
  - Cà phê đá 500ml, `unit_price` 21000, qty 1, `gross_line_total` 24000, no discounts;
  - `modifiers_snapshot_json` = `[{"id":"opt-cot","name":"20ml cốt cà phê","price":3000,"qty":1},{"id":"opt-it-da","name":"Ít đá","price":0,"qty":1}]`.

  Expect:
  - exactly 2 rows: the dish and `MOD:opt-cot`;
  - revenues 21000 and 3000, summing to 24000;
  - no `MOD:opt-it-da` row.
- [ ] **Step 2: Run and expect FAIL** (3 rows come back): `npx vitest run lib/reports/report-v2-allocators.test.ts`
- [ ] **Step 3: Implement.** Make this the first statement inside `for (const mod of modifiers)`:

```ts
      if (Number(mod.price) === 0) continue; // 0đ choices (Ít đá, Ít ngọt) are not toppings and carry no revenue
```

- [ ] **Step 4: Run and expect PASS.** The existing test that checks the sum against `net_total` must stay green.
- [ ] **Step 5: Commit** `fix(reports): 0đ options stay out of the topping rows`.

Accepted limit: a free topping, if one is ever created, would not appear in any report row. None exists on 2026-10-17.

### Task 3: Script that creates Độ ngọt and Đá (backend-coder; never `--apply`)

**Files:**
- Create: `scripts/seed-sweetness-ice-groups-core.ts`, with `buildSeedSql(apply: boolean, excludeProductNames: string[]): string`
- Create: `scripts/seed-sweetness-ice-groups.ts`, the runner
- Test: `scripts/seed-sweetness-ice-groups-core.test.ts`

Facts already checked on 2026-10-17:
- `modifier_groups` and `modifiers` carry only BEFORE UPDATE `touch_updated_at` triggers. `modifier_group_products` has none.
- Thêm Topping is MG-001 with sort_order 50.
- The highest option id is MOD-010.
- `supabase db query -f` returns the last row-returning statement, even when the file ends with `rollback;` (probed with a temp table).

Read `supabase/migrations/0119_modifier_groups.sql` for:
- the `modifier_group_products.id` convention, `group_id || ':' || product_id`;
- `modifiers.group_name`, which is still read and must equal the group name;
- the advisory-lock pattern;
- the name index.

Take column names and NOT NULL columns from `information_schema.columns`, through a read-only query file in `.worktrees/` run with bare `npx supabase db query --linked -f`.

The SQL file is one transaction. It opens with `begin;` and ends with `commit;` under `--apply`, `rollback;` otherwise. In between, in order:

1. `perform pg_advisory_xact_lock(hashtext('modifier_groups:id'))` and `hashtext('modifiers:id')`, inside a `do` block.
2. A `before` count: rows in `modifier_groups`, in `modifiers`, and links of MG-001.
3. Two groups, both ACTIVE, `selection_mode` ONE, `allow_standalone` false, `max_total` null:
   - Độ ngọt, sort_order 10;
   - Đá, sort_order 20.
   Ids are the next `MG-###` above the current maximum, computed in SQL. A duplicate name is refused by the existing unique index, so no extra guard is needed.
4. Seven options, all price 0, ACTIVE, `product_id` null, `max_qty` null, `group_id` and `group_name` set:
   - Độ ngọt: Bình thường (`is_default` true), Ít ngọt, Không đường;
   - Đá: Bình thường (`is_default` true), Ít đá, Không đá, Đá riêng.
   Ids are the next `MOD-###` above the current maximum, in that order. The gap at MOD-007 is never filled.
5. Links from each new group to every `product_id` linked to MG-001, minus the products whose name is in `excludeProductNames`. Each link id is `group_id || ':' || product_id`.
6. A final `select` returning one JSON value with:
   - the `before` counts;
   - the `after` counts;
   - the new group ids and names;
   - the new option ids and names;
   - the linked product names by group.

Runner:
- Prints `MODE: dry run (no writes)` or `MODE: --apply (WILL WRITE)`, and the trigger list (the query for bulk-data-change step 1).
- Writes the SQL to `.worktrees/seed-sweetness-ice.sql` and runs it, then prints the JSON.
- After `--apply`, runs a separate read-only `select` to re-read the end state (step 4).
- Reports side effects: inserts fire no `updated_at` trigger, and nothing else is queued.
- Keeps `EXCLUDE: string[] = []` as a constant at the top of the file, filled in from the owner's answer before any apply.
- Note in the header comment: the dry run executes the inserts and then rolls them back.

Core test:
- the SQL ends with `rollback;` without apply and `commit;` with apply;
- it takes both advisory locks;
- it names all 7 options;
- it contains no hardcoded `MG-002` or `MOD-011`;
- an excluded name appears in a `not in` filter, with single quotes escaped.

- [ ] Step 1: write the failing core test.
- [ ] Step 2: run it and expect FAIL.
- [ ] Step 3: implement the core and the runner.
- [ ] Step 4: run the test and expect PASS. Then run the dry run once: `npx vite-node scripts/seed-sweetness-ice-groups.ts`. Paste the whole output into the hand-back. Never pass `--apply`.
- [ ] Step 5: commit `feat(scripts): dry-run script for the Độ ngọt and Đá option groups`.

### Task 4: Dish grid, inline picker, phone sheet (Gemini)

**4a — tests (Gemini Flash).** Write these tests first. Opus runs vitest and records each red result, noting whether it fails on a missing element or a wrong value.
1. Tapping "Cà phê đá" adds nothing to the cart and shows the "Cỡ ly" group with 360ml lit.
2. Two adds of the same picks in a different order give one cart line with qty 3.
3. A different pick gives a second line.
4. Editing a line, then Cập nhật, keeps the line count.
5. Editing line A, then removing A from the cart, then tapping Cập nhật: the picker closes, nothing crashes, and the cart is unchanged (Review Focus 1).
6. Inside the picker, the discount box is not `type="number"`.
7. The dish card has no "Thêm … 360ml" buttons.
8. Trứng luộc opens the picker with only the size group.
9. The picker's + is disabled at 99.

Update or delete the old one-tap tests:
- `ProductCard.test.tsx`;
- `ProductGrid.test.tsx`;
- `POSScreen.test.tsx`, near lines 654–845;
- `POSScreen.itemModal.test.tsx`;
- `cart-pricing.test.ts`, the `addQuickLine` block.

Reason: `BR-SALE-019` reverses one-tap. Rename `ItemConfigModal.test.tsx` to `ItemPicker.test.tsx`. Keep the aria-labels "Thêm một phần X", "Bớt một phần X" and "Bỏ X".

**4b — build (Gemini Argon, whole-page redo).**

Files:
- `POSScreen.tsx`, `ProductGrid.tsx`, `ProductCard.tsx`;
- a new phone row component in `app/pos/components/`;
- `ItemConfigModal.tsx` becomes `ItemPicker.tsx`, keeping the `ItemConfigSubmission` type;
- `components/ui/OptionGroupPicker.tsx` moves to `app/pos/components/OptionGroupPicker.tsx` (till-only);
- `components/ui/phone-size.guard.test.ts`: remove the `TILL_ONLY` entry and its comment;
- `cart-pricing.ts`: delete `addQuickLine` once nothing calls it.

Layout:
- `POSScreen` owns the layout. `ProductGrid` receives `products` (all of them) so the rail can show counts.
- **1024 px and wider:** a left rail 132 px wide, with the same items as today's tabs ("Bán chạy", categories). Each item is 70 px tall, with the name 16 px bold and "N món" under it. "Bán chạy" has no count.
- **768–1023 px:** the tab row stays, as today.
- **Phone:** tabs plus 64 px dish rows with 18 px names and a price range. The touch swipe between tabs stays, on the phone only.
- **Cards (768 px and wider):** a 3-column grid. Each card is 90 px tall and shows the name at 18 px and the list-price range at 17 px ("15,000 – 18,000", or one price). The "Khuyến mãi" badge stays. The dish open in the picker gets a 2 px primary border.
- **Cart column:** keeps `md:w-80 lg:w-96`.

Picker placement:
- **768 px and wider:** inside the centre column, below the grid, as a normal block. Its max height is 60% of the column. The groups area scrolls, and the footer stays visible. The grid above keeps at least 200 px and scrolls.
- **Phone:** a fixed bottom sheet at `z-50`, above the cart sheet (`z-40`). Its top sits about 54 px below the screen top, over a dim backdrop. Tapping the backdrop or ✕ closes it.
- On the phone, a line edit starts from inside the cart sheet. The picker opens above it. After Cập nhật or ✕, the cashier is back in the cart sheet.

Groups:
- Group 1 is "Cỡ ly": sizes by list price, ascending, with the cheapest lit when adding.
- Then come the dish's `groups`, numbered 2, 3, …
- Each group is a framed block: a header band, slightly darker than the card, with a primary numbered circle and the bold name. On the phone, the header also shows "✓ <lit option>" on the right for ONE groups.
- Each option is a full-width row, and the whole row is the tap target. ONE options show a radio; MANY options show a square check. A price above 0 appears on the right ("+4,000").
- For a MANY option with `max_qty` above 1, a row tap adds a portion while `canAddPortion` allows. Once N ≥ 1 the row shows "×N" and a − button.
- "Đã chọn trước" orphan rows stay, so a removed option can still be taken off an old line.
- On the computer, the groups sit in `grid-template-columns: repeat(auto-fit, minmax(170px, 1fr))`.

Footer:
- Quantity stepper, from 1 to 99.
- "Bỏ" (computer) closes with no change.
- The main button reads "Thêm vào đơn · <total>", or "Cập nhật · <total>" when editing. The total is the promo-aware figure `ItemConfigModal` computes today.
- "Giảm giá món" is a collapsed disclosure. It starts open when the line being edited has a discount. Inside it:
  - the VND/% toggle;
  - a box with `type="text"`, `inputMode="numeric"` and placeholder "0", digits only, clamped by `clampDiscount`.

Submit:
- `modifiers: orderPicks(picks, groups)`.
- **Add:** `setCart(c => addOrMergeLine(c, line))`.
- **Edit:** find the index of `editingLineId`, then replace the line in place. If the line is gone, close the picker.
- Close the picker after the submit.

Other behaviour:
- Tapping another dish switches the picker to it, through the existing `key` remount.
- Esc closes the picker.
- The picker closes when checkout starts.

### Task 5: One Thanh toán button, method step, Enter (Gemini Flash)

**5a — tests (Flash).** Write them first. Opus records the red run.
1. There is one "Thanh toán" button and no "TIỀN MẶT" in the order view.
2. Clicking it shows "Khách trả bằng gì?", and Tiền mặt has focus.
3. Tiền mặt calls checkout with "Tien mat"; Chuyển khoản calls it with "Chuyen khoan".
4. Offline: Thanh toán is disabled. Offline with the step open: Tiền mặt and Chuyển khoản are disabled.
5. Enter with lines opens the step. Enter with an empty cart does nothing. A repeat Enter (`repeat: true`) does nothing.
6. Quay lại đơn returns to the order view.
7. Sending empties the cart and closes the step.
8. Adding a dish while the step is open closes it.
9. A cart line reads "360ml · Ít ngọt · Ít đá · Kem muối". There is no "Size " prefix. Two portions of the same topping show as "Kem muối ×2".

Update the Enter tests in `POSScreen.test.tsx` (near lines 156–265), the two-button tests in `CartPanel.test.tsx`, and those in `POSScreen.checkoutToast.test.tsx` and `POSScreen.offline.test.tsx`. Reason: `BR-SALE-020`. Create `CartItemRow.test.tsx`.

**5b — build (Flash).** Files: `CartPanel.tsx`, `CartItemRow.tsx` and `POSScreen.tsx` (Enter handler and `isPayStepOpen` state only).

- **Order view.** Lines, the promo and discount disclosure, and the totals stay as they are, at the new sizes. One button, "Thanh toán", 64 px.
- **Method step.**
  - The step replaces only the button area. The lines and the total stay visible above it.
  - It shows the heading "Khách trả bằng gì?", then:
    - Tiền mặt, solid primary, focused on open;
    - Chuyển khoản, outlined;
    - "Chia tiền mặt + chuyển khoản", a text button that opens the existing split popup;
    - "‹ Quay lại đơn".
  - The calls to `handleConfirmCheckout` do not change.
  - `isPayStepOpen` goes false in a `useEffect` on `cart`.
- **Phone.** The bottom bar reads "<n> · <total>đ · Thanh toán ›" and opens the cart sheet at the order view.
- **Enter.**
  - `if (e.repeat) return;` comes first.
  - Then, only when all of these hold, Enter calls `setIsPayStepOpen(true)`:
    - the cart has lines;
    - the till is online and not sending;
    - no picker is open;
    - the drafts popup is closed;
    - the step is closed.
  - Remove the "Xác nhận thanh toán TIỀN MẶT" confirm and `enterConfirmOpenRef`. Keep the `confirm` import, which `loadDraft` still uses.
- **Cart line.** The name is 17 px. The sub-line is 15 px and lists the size and then the options, joined by " · ". Repeated portions show as "Name ×N".

### Task 6: Docs (Opus)

- `docs/02-rules/business-rules/till.md`: change "Not yet rebuilt" to "Built on branch `feat/pos-pick`, not yet pushed" for both rules.
- Grep for every reference to `2026-10-17-may-ban-hang-lam-lai`, then delete that plan, since it is done and merged. In the same commit, repoint `docs/02-rules/business-rules/notices.md:7` to this plan.
- Self-decided points stay in spec section 9 until the owner approves them. Only then do they go into `till.md`.

### Task 7: Checks, review, browser

- **Five checks:** `npx tsc --noEmit`, `npx vitest run` (main folder after merge), both doc checks, and `npm run build` in a throwaway worktree.
- **Review:** an independent `reviewer` agent after Tasks 1–3, after 4b, after 5b, then the whole branch.
- **Playwright on 8386.**
  - Block non-GET requests. Never tap Tiền mặt, Chuyển khoản, Lưu or Xoá.
  - Sizes: 390×844, 360×780, 1024×768, 1280×800 and 1920×1080.
  - Steps:
    1. Open Cà phê đá.
    2. Add 2 with Kem muối.
    3. Add 1 with no topping.
    4. Add 1 the same as step 2.
    5. Edit a line.
    6. Tap Thanh toán, then Quay lại đơn.
    7. Press Enter.
  - Until the owner approves the data write, live data shows only Cỡ ly and Thêm Topping. The four-group look is checked with a fixture render of the picker.
  - Judge each screenshot by eye against BF and PF.
- **Finish:** stop 8386 and close the browser.
