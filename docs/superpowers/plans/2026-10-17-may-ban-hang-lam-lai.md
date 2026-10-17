# Máy bán hàng: redo the main screen (bản A) and one notice style

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** the till's main screen follows mockup A (https://claude.ai/artifact/DEbZg7kdYiKDwc2rvWKaNW, boards "Main" and "Notice"):
- tap a size on a dish card to add it;
- a calmer cart with thumb-sized steppers and two big pay buttons;
- one notice style, shared by the till now and by the admin pages later.

**Why:** the owner sent a photo of the till on 2026-10-17: *"anh thấy nó vẫn chưa được tối ưu… bảng thông báo đơn hàng thành công trông cũng không phải cùng một form đồng nhất"*. He chose "Làm lại cả màn hình". Mockups A, B and C were drawn after looking at KiotViet FnB, Sapo FnB, iPOS and Square. A was recommended. Under the owner's 2026-10-15 delegation the recommendation is taken and listed in the end-of-batch report.

**Kind of work:** a redo of an existing screen. There is no new table and no new `app/` folder, so the design is written here rather than as a separate spec (CLAUDE.md, Quy trình). Sonnet critiqued the first draft on 2026-10-17. Its twelve required changes are folded in and marked "(critique)".

**Tech:** Next.js 16, React 19, Tailwind 3.4 (default breakpoints: md 768, lg 1024, xl 1280), lucide-react (installed), Vitest + Testing Library.

## Measured 2026-10-17 (read-only queries)

- **Dishes:** 45 on sale, all of which reach the till.
  - `app/pos/page.tsx:67,77` only passes active sizes, and only dishes with at least one of them.
  - Sizes per dish: 35 have one, 8 have two, 2 have three.
  - Size names: "1 phần", "1 trái", "360ml", "500ml", "700ml", "1000ml" (at most 6 characters).
- **Options:** 35 dishes have an option group.
  - Every group is "MANY".
  - No option is a default, and no group demands a pick.
  - So a size added with no options is always a valid line.
- **How often options are used:** in the last 30 days, **40 of 999** completed order lines carried an option.
  - Today every line takes at least two taps: the card, then THÊM in the window.
  - With size buttons, about 96% of lines take one tap.
- **Longest dish name:** "Matcha oatside caramel kem muối" (31 characters).
- **Categories:** Cà phê, Trà, Yogurt, Giải trí, Thức ăn, Topping.
- **Category icons** (owner data, `BR-SALE-017`): Cà phê ☕, Trà 🍵, Yogurt 🥛. The other three have none.

## Hiện trạng

**Read:**
- `app/pos/components/`: mapped by Haiku on 2026-10-17, then checked against `POSScreen.tsx` 976–1060 and 880–912, `ItemConfigModal` 1–262, `ProductCard.tsx` 1–30 and `ProductGrid.tsx` 7–20;
- `CartPanel.tsx` 160–170;
- `POSScreen.checkoutToast.test.tsx`;
- `lib/shared/dialog.ts`, `lib/sales/option-groups.ts`;
- `tailwind.config.ts`, `app/globals.css` 1–60;
- `BR-SALE-015` to `-018`, `BR-UI-005`, `BR-UI-014`.

**Not read in full:** `CartPanel.tsx` 1–160 and 170–700, `CartItemRow.tsx`, `DraftsModal.tsx`.

1. **States.**
   - **Online / offline** (`isOnline`): offline shows a banner and turns off the pay buttons and Enter (`BR-SALE-015`). Unchanged.
     - Adding dishes while offline stays allowed, as the dish window allows it today (critique 11).
   - **Sending** (`isCheckingOut`):
     - the pay buttons show "Đang gửi…";
     - cards, size buttons and cart lines do nothing;
     - the cart is cleared at once and put back on failure (`restoreCart`). A dish added during a send would therefore be lost, and the size buttons must refuse it.
   - **Failed send** (`lastCheckoutError`): the "Gửi lại" strip in the cart resends the frozen cart. Any change to the cart clears it, so that Gửi lại never sends a cart other than the one on screen (`POSScreen.tsx` 420–450). A quick add must clear it too (critique 2).
   - **Other states, unchanged:**
     - cart empty or not empty;
     - phone cart sheet open or closed (`isCartOpen`);
     - dish window open (`selectedProduct`), with `editingCartIndex` null when adding or a number when editing;
     - drafts window open.
   - **Notices:** a list kept in POSScreen state. Four kinds: success, error, warning, info.
2. **Buttons.** Labels stay as today unless named here, so the tests that find buttons by label keep working (critique 7). The labels that stay: "TIỀN MẶT", "CHUYỂN KHOẢN", "Nhiều hình thức", "NGOẠI TUYẾN", "Đang gửi…", "Lưu Nháp", "Xoá hết", "Nháp", "Đăng xuất".
   - **Header:** back to admin, title, online pill, Nháp (with its count), date, Đăng xuất. The look is new but the set of buttons is the same. Below `xl`, the words beside the icons are hidden and the `aria-label` stays, so nothing is pushed off at 1024 px.
   - **Category tabs:** "Bán chạy" (the 🔥 is dropped), "Tất cả món", then one tab per category.
   - **Dish card:**
     - the **name area** is a button that opens the dish window (options, item discount, quantity);
     - **each size button** adds that size at once, with quantity 1 and no options.
   - **Cart line:** unchanged in behaviour. Tap the name to edit; − and + are now 44 px; remove by swiping on a phone or with the trash icon on a computer.
   - **Pay:** the same three buttons with the same labels and rules. New look:
     - CHUYỂN KHOẢN as a brown outline;
     - TIỀN MẶT solid brown, both 56 px;
     - "Nhiều hình thức" a 44 px text button across both.
   - **"Khuyến mãi, giảm giá":** a disclosure button, closed by default.
     - It opens today's promo-code box and order-discount box in place (not a popup).
     - It is open from the start when a code or an order discount is applied, so an applied discount is never hidden.
3. **Lists.**
   - **Dish grid:** the filtered products, as today (tab plus search, diacritics ignored). Every dish has at least one size (see Measured).
   - **Size buttons on a card:** the dish's sizes, cheapest first.
   - **Cart lines:** as today.
   - **Notices:**
     - newest at the bottom;
     - at most three non-error notices are shown, and the oldest non-error one is dropped first;
     - error notices are never dropped and stay until closed (critique 4).
4. **Inputs.** Unchanged: search box, promo code, order discount and item discount (`inputMode="numeric"`), split amounts.
5. **Data served.** No server action, query or table changes. A quick add writes the same cart-line shape that the dish window writes, so the order sent is the same kind of order.

Extra questions for this screen:

6. **Two taps on the same size:** one line with quantity 2, as Square and KiotViet do. Only a line with the same size, no options and no item discount is merged. Anything else becomes a new line.
7. **A promotion on a size:** the size button shows the price the customer pays (from `promoVariantsMap`), and the card shows a "Khuyến mãi" tag. The struck-through old price stays in the dish window only.
8. **Category icons** (`BR-SALE-017`): move from the dish card to the tab, before the category name.
   - Today a card with an icon and a card without one sit at different heights.
   - In the tab, the owner's icon still shows and every card lines up.
9. **Wide screens** (the owner saw oversized cards): from md up, the grid fills columns of at least 11 rem (176 px), so a 1920 px screen shows more cards, not bigger ones.
   - Widths:
     - 768 px with a 320 px cart: 416 px of grid, 2 columns;
     - 1024 px with a 384 px cart: 608 px, 3 columns.
   - A dish with three sizes wraps its buttons 2 + 1 on narrow cards. Playwright looks at both three-size dishes.
10. **Enter after a size tap** (critique 3): Enter pays cash (`BR-SALE-018`). A tapped size button must give up focus, so that Enter is not taken as a second tap on it.
11. **The success notice** keeps the owner's instruction recorded in `POSScreen.checkoutToast.test.tsx`: *"khi nhân viên bấm tạo đơn thành công sẽ không thông báo mã đơn mà chỉ thông báo thành công"*. Its title is "Thanh toán thành công", with no order code and no other line (critique 1).

## Worked example (real order, read-only)

Order `261016001020`, 2026-10-16 07:57, Chuyển khoản, 43,000đ:

| Line | Id | Dish | Size | Qty | Options | Line total |
|---|---|---|---|---|---|---|
| 1 | ol-7d255a57… | Trứng luộc | 1 trái | 2 | — | 10,000 |
| 2 | ol-6ced5b36… | Khoai lang | 1 trái | 2 | — | 10,000 |
| 3 | ol-b7d89902… | Cà phê sữa đá | 500ml | 1 | Caramel 3,000 | 23,000 |

On the new screen:
1. Tap "1 trái 5,000" on Trứng luộc twice: one line, quantity 2, 10,000.
2. Do the same for Khoai lang.
3. For the coffee, tap the name "Cà phê sữa đá" to open the dish window. Choose 500ml and Caramel, then THÊM 23,000.
   - Or tap "500ml 20,000", then tap the line and add Caramel.
4. The total is 43,000đ. Tap CHUYỂN KHOẢN.

Taps: 2 + 2 + 4 + 1 = 9. Today it is 3 + 3 + 4 + 1 = 11:
- a plain line of quantity 2 is card, +, THÊM;
- the coffee is card or name, 500ml, Caramel, THÊM either way.

## Global constraints (copy into every brief)

- **Till rules stay:** `BR-SALE-008`, `BR-SALE-015` (no selling offline; Gửi lại keeps the request token), `BR-SALE-018` (TIỀN MẶT sends at once; Enter asks once), and idempotent checkout.
  - Do not touch `app/pos/actions.ts`, `lib/`, or how an order is built and sent.
  - Every cart change clears `lastCheckoutError`.
- **Colours from tokens only** (`tailwind.config.ts`).
  - Brown `primary` is the main colour.
  - `warning` is red in this app (the same as `danger`), so do not use it for amber.
  - Task 2 adds two tokens; use nothing else new.
- **No emoji drawn by code** (💵 💳 🔥 ⚠️ 🟢 🔴 ℹ️ 📝). Icons come from lucide-react. Category icons are owner data and stay.
- **Touch:** anything tappable is at least 44 px tall at every width.
- **Words:** every word on screen is Vietnamese. Keep today's button labels (see Hiện trạng 2).
- **Money:**
  - totals use `formatNumber(x)` + "đ";
  - prices on size buttons have no "đ" (as in the mockup).
- **Phone (below 768 px):**
  - the cart stays a bottom sheet, with today's collapsed bar and its text;
  - the dish grid has 2 columns.
- **768 px and up:** the cart column stays as it is today, `md:w-80 lg:w-96`. There is no xl change (critique 8).
- **Smallest change (ponytail):**
  - no new state library or context;
  - no wrapper components beyond `ToastStack`;
  - notice state stays in POSScreen;
  - no field or feature a step does not name.
- **Tests:** keep `<p>` elements for a notice's text. `POSScreen.checkoutToast.test.tsx` reads `[aria-label="Thông báo"] p`.
- **Gemini runs:** no shell commands. Opus runs the tests afterwards.

## Review focus

1. **Size tap during a send:** after the send fails, the cart is exactly the frozen cart, with nothing added (Task 3a test).
2. **Merging two taps:** a second tap merges only into a plain line. A line with options or an item discount, or a draft line with no `modifiers` field, behaves correctly (Task 1 tests).
3. **Enter after a size tap:** it opens the cash confirm and adds nothing (Task 3a test).
4. **Size tap after a failed send:** the "Gửi lại" strip disappears (Task 3a test).
5. **Header at 1024 px:** Đăng xuất is fully visible and tappable. Notices at 390 px do not cover the header's buttons for longer than their timer (Playwright).

---

## Task 1: quick-add helper (backend-coder)

**Files:**
- modify `app/pos/components/cart-pricing.ts`;
- test in `app/pos/components/cart-pricing.test.ts`.

**Produces:**
```ts
export function addQuickLine(
  cart: any[],
  product: { id: string; name: string },
  variant: { id: string; size_name: string; price: number | string },
): any[]
```

It returns a new array and never mutates its input.

**Merge case.** A line is merged when all three hold:
- `variant_id === variant.id`;
- `(l.modifiers ?? []).length === 0`. A draft's `cart_json` comes back as stored and may lack the field (critique 10);
- `!l.discount_amount`.

The first such line gets `qty + 1`, as a new object.

**New line case.** Otherwise the helper appends:
```ts
{ id: crypto.randomUUID(), product_id: product.id, product_name: product.name,
  variant_id: variant.id, size_name: variant.size_name, unit_price: Number(variant.price),
  modifiers: [], qty: 1, discount_amount: 0, discount_type: "VND" }
```

The field names match `handleItemConfigSubmit` (`POSScreen.tsx` ~397–408); read it and confirm. `crypto.randomUUID()` replaces `Date.now()` because two taps in the same millisecond would clash as React keys.

- [ ] Write the tests first. They are red because the function is missing. Cases:
  - an empty cart gives one line with quantity 1 and a numeric `unit_price`;
  - the same size again gives one line with quantity 2;
  - a line of that size with one option gives a new line;
  - a line of that size with `discount_amount` 2000 gives a new line;
  - a draft-shaped line with no `modifiers` field merges;
  - a different size of the same dish gives a new line;
  - the input array and its line objects are not mutated.
- [ ] Implement, run `npx vitest run app/pos/components/cart-pricing.test.ts`, and commit.

## Task 2: shared notice (Gemini Flash, its own run)

**Files:**
- create `components/ui/Toast.tsx` and `components/ui/Toast.test.tsx`;
- modify `tailwind.config.ts` and `app/globals.css` (two tokens).

**Tokens:** `--color-caution: #9A6700` and `--color-info: #3B5B7A`.
- Each gets its `-rgb` triplet, in the same pattern as the others in `:root`.
- The Tailwind colours `caution` and `info` are mapped the way `danger` is.

**Produces:**
```ts
export type ToastKind = "success" | "error" | "warning" | "info";
export interface ToastItem { id: string; kind: ToastKind; title: string; detail?: string }
export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }): JSX.Element
```

There is no `action` field: no notice offers one, because "Gửi lại" stays the cart strip (critique 5).

**Look** (mockup board "Notice"):
- **The stack:**
  - fixed, top centre (`top-3 left-1/2 -translate-x-1/2`);
  - width `min(92vw, 28rem)`, gap 8 px, `z-[70]`;
  - `role="region" aria-live="polite" aria-label="Thông báo"`.
- **Each notice:**
  - a white card (`bg-surface-card`) with `border border-border`, a 4 px left bar in its colour, `rounded-card`, `shadow-panel`, and 12/16 padding;
  - a 22 px lucide icon in its colour: success `CheckCircle2` (`primary`), error `AlertCircle` (`danger`), warning `AlertTriangle` (`caution`), info `Info` (`info`);
  - the title as a bold 15 px `<p>`;
  - the detail as a 14 px `<p>` in `text-text-secondary`;
  - a 44 px ✕ button on the right (`aria-label="Đóng"`, lucide `X`).

**Timing** lives in `ToastStack`:
- success and info close after 3 s;
- warning closes after 5 s;
- error never closes by itself.
- Timers are cleared on unmount and when a notice is dismissed.

- [ ] Write the tests first:
  - the region renders;
  - with fake timers, a success notice calls `onDismiss` after 3 s, and an error notice has not called it after 10 s;
  - ✕ calls `onDismiss(id)`;
  - title and detail are `<p>` elements;
  - the output contains no emoji.

## Task 3a: grid, cards, tabs, quick add (Gemini Argon)

**Files:**
- `app/pos/components/POSScreen.tsx` (only `handleQuickAdd` and the props passed to `ProductGrid`);
- `ProductGrid.tsx` and `ProductCard.tsx`;
- `ItemConfigModal.tsx` (colours only);
- their tests.

**Consumes:** `addQuickLine` (Task 1).

**New code in POSScreen:**
```ts
const handleQuickAdd = (product: any, variant: any) => {
  if (isCheckingOut) return;
  setCart(c => addQuickLine(c, product, variant));
  setLastCheckoutError(null);
};
```
Also a memo, `productsWithOptions: Set<string>`, holding the ids of products that `optionGroupsForProduct(...)` gives at least one group.

**New props.** No props beyond these (critique 9).
- `ProductGrid` props: today's, plus `promoVariantsMap: Map<string, number>`, `productsWithOptions: Set<string>`, `onQuickAdd: (product: any, variant: any) => void` and `disabled: boolean` (passed `!!isCheckingOut`). `promoProductsMap` is dropped if nothing else reads it.
- `ProductCard` props: `product`, `sizes: { variant: any; price: number }[]` (already cheapest first, with the promo price applied), `hasPromo: boolean`, `hasOptions: boolean`, `disabled: boolean`, `onOpen: () => void`, `onQuickAdd: (variant: any) => void`.

**Steps:**
1. **Tabs:**
   - one row that scrolls sideways on every width (no wrapping), with 44 px pills;
   - the active tab is `bg-primary text-on-primary`;
   - "Bán chạy" has no emoji;
   - each category shows its icon (data) before its name.
   - The swipe between tabs stays.
2. **Grid:** `grid-cols-2` below md, and `md:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]` from md. Gap 12 px, padding 16 px.
3. **Card:** a white `<div>` (not a button) with a border, `rounded-card` and 12 px padding.
   - **Top:** a `<button>` (`onOpen`) holding:
     - the dish name, 15 px semibold, at most 2 lines and then clamped;
     - under it, a small grey "Có tuỳ chọn" when `hasOptions`;
     - a "Khuyến mãi" tag (`bg-primary-soft text-primary`) when `hasPromo`.
   - **Bottom:** `flex flex-wrap gap-1.5` with one `<button>` per size.
     - Each is `flex-1 basis-[4.5rem] min-h-[44px] bg-primary-soft rounded-button`.
     - Each has two lines: the size name (12 px, `text-text-secondary`) and the price (14 px bold `text-primary`, `formatNumber`, no "đ").
     - `aria-label="Thêm {dish} {size}"`.
     - `onClick={e => { onQuickAdd(variant); e.currentTarget.blur(); }}` (critique 3).
     - `disabled` when `disabled`.
4. **Dish window:** selected size and selected options use `primary` instead of `warning`, and the main button is `bg-primary`. No other change.

- [ ] Write the tests first (POSScreen level). Each new test must fail on today's code:
  - tapping "Thêm Cà phê đen M" adds one line of size M, quantity 1;
  - tapping it twice gives quantity 2;
  - while a send is pending, a size tap adds nothing, and after the send fails the cart equals the frozen cart;
  - after a failed send, a size tap removes the "Gửi lại" strip;
  - after a size tap, Enter opens the cash confirm and the quantity stays 1;
  - tapping the dish name opens the dish window.
- [ ] Rewrite `ProductCard.test.tsx` and `ProductGrid.test.tsx` for the new props. Update `ProductGrid.test.tsx:57` and `POSScreen.test.tsx:535-548` ("🔥 Bán chạy" becomes "Bán chạy"). Check every test that does `getByText(<price>)` for a double match.

## Task 3b: header, cart column, notices (Gemini Argon, after 3a is merged)

**Files:**
- `app/pos/components/POSScreen.tsx`;
- `CartPanel.tsx`, `CartItemRow.tsx`;
- `DraftsModal.tsx` (emoji only);
- their tests.

**Consumes:** `ToastStack` and `ToastItem` (Task 2).

1. **Notices.** Replace POSScreen's own toast markup and `addToast` with `ToastItem[]` state and `<ToastStack>`, applying the drop rule from Hiện trạng 3. Messages:
   - paid: "Thanh toán thành công", success, nothing else;
   - back online: "Đã có mạng trở lại", info;
   - send failed: title "Chưa gửi được đơn", detail = the message today's code shows, error;
   - logout while the cart has items: "Lưu nháp hoặc thanh toán trước khi đăng xuất", warning;
   - a draft could not be saved or deleted, or the current cart could not be saved before opening a draft: error, with today's wording as the detail. These replace the `alert(...)` calls at ~222, ~228 and ~264, and the toast at ~243;
   - a dish with no size: "Món này chưa cấu hình size & giá.", warning. This replaces the `alert` at ~385, which stays as a guard.
   - `confirm(...)` calls stay as they are, because they ask a question.
2. **Header:**
   - `h-14`, white, with a bottom border;
   - every button is 44 px and uses a lucide icon;
   - the 📝 becomes lucide `FileText`;
   - the words "Nháp", "Đăng xuất", the online pill's word and the date chip are hidden below `xl`; the `aria-label`s stay.
3. **Offline banner:** `bg-caution text-white` with lucide `WifiOff` and today's text without the ⚠️. Update `POSScreen.offline.test.tsx:61`.
4. **Cart column:**
   - **Header:** "Hoá Đơn (n)" as today, with Lưu Nháp and Xoá hết as 44 px text buttons.
   - **Lines:** the name (15 px semibold) with the line total on the right; a grey second row with size · options and today's badges; then a stepper (−, quantity, +), each part 44 px, with brown icons.
   - **Promo disclosure:** below the lines, the "Khuyến mãi, giảm giá" disclosure (dashed border, 44 px) holds today's promo and discount controls unchanged.
   - **Summary rows and pay buttons:** today's, restyled as in Hiện trạng 2, with the 💵/💳 emoji removed.
5. **Phone sheet:** the same collapsed bar and sheet, restyled with the same parts. The texts are unchanged.
6. **Dead code:** the always-hidden floating cart button (POSScreen ~1096–1107) goes.

- [ ] Write the tests first. Each must fail on today's code:
  - with an applied promo code, the disclosure is open;
  - with nothing applied, it is closed and the promo-code box is not in the page;
  - an error notice survives four later success notices;
  - draft-save failure shows an error notice, not a dialog.
- [ ] Update these existing tests and name each one in the report:
  - `POSScreen.test.tsx:313,486`, if the success title loses its "!";
  - `POSScreen.offline.test.tsx:61`;
  - any test asserting the emoji, toast colours or `bg-surface-secondary rounded-xl p-1.5`;
  - the alert-text tests, which now read notices.

  Do not weaken checkout, offline, retry or draft tests.

## Task 4: rules and Playwright (Opus)

- **`BR-SALE-017`:** the icon shows on the category tab, not the dish card (2026-10-17, mockup A, under delegation).
- **New `BR-UI-020`** in `docs/02-rules/business-rules/screens.md`: one notice style (`components/ui/Toast.tsx`), four kinds, the timings above. Admin pages adopt it as each area is redone.
- **Playwright** on 8386, with mutating requests blocked:
  - **Widths:** 360×780, 390×844, 768×1024, 1024×768, 1280×800, 1920×1080.
  - **Look at:**
    - tabs;
    - cards, including both three-size dishes;
    - a size tap, and a name tap;
    - the cart and the disclosure;
    - the offline banner (emulate offline);
    - a success notice and an error notice, mocked by blocking the send request.
  - Nothing is sent.

## Order and runs

1. Tasks 1 and 2 run at the same time: backend-coder in `.worktrees/pos-t1`, Flash in `.worktrees/pos-t2`.
2. A reviewer checks each, then each is merged into `feat/pos-redo`.
3. Then Task 3a runs (Argon), followed by review and merge.
4. Then Task 3b runs (Argon), followed by review and merge.
5. Then Task 4.

## Done when

- the five checks pass in the main folder;
- every `app/pos` test passes;
- the reviewer approves Tasks 1, 2, 3a and 3b;
- the Playwright table has no failed step.

The till is not pushed before the owner's push approval, and the push happens while no order is in the till (CLAUDE.md: anything that can stop the till is said first).
