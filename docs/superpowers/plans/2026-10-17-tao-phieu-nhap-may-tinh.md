# Tạo phiếu nhập và Tạo phiếu xuất trên máy tính: bố cục mới (đợt 2a)

> **For agentic workers:** this is UI work, run by Gemini Flash via agy (Argon is not used, owner 2026-10-18) after wave 1 (`2026-10-17-giao-dien-dot-1.md`) is merged. Branch from main after that merge. Opus runs the tests.

**Goal:** on a computer, both forms read like a paper invoice.
- The order details sit at the top.
- The item lines run across the full width.
- Money and payment sit underneath.

The phone layout (under 768 px) does not change.

**Why:** the owner said "tạo đơn nhập rất khó khăn" on a computer. The 2026-10-17 audit at 1280×800 (`.worktrees/shots/verify/d-po-new-1.png`, `.worktrees/shots/audit2/d-admin_inventory_issue-slips_new.png`) measured these faults:
- The lines get two thirds of the width, so the item picker is about 115–120 px wide and names are cut.
- On Phiếu nhập, the ✕ button is absolutely positioned over the "Mặt hàng" label.
- The money block sits below the order details in the right column, out of sight.
- On Phiếu xuất, the headers wrap to three lines and "-- Chọn hàng --" wraps to two.

**Earlier decision this changes:** on 2026-10-10 the owner accepted the recommendation of two columns on a computer for these two pages (`docs/superpowers/plans/2026-10-06-ke-hoach-chung.md`, Phần 0). The widths measured in the critique show that two columns leave the item column narrow on every screen, wide monitors included:

| Window | Item column, two columns | Item column, stacked |
|---|---|---|
| 1280 | about 120 px | about 330 px |
| 1536 | about 145 px | — |
| 1920 | about 225 px (content capped at 1280 px) | — |

So the blocks stack on every computer width. **Tell the owner at the end:** the 2026-10-10 layout changed, and why.

**Reference:** KiotViet's purchase screen (https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-giao-dich/nhap-hang/) shows the items as one wide table, one row per item. It adds items through a search box. We keep our "+ Thêm mặt hàng" button: a search box would be a second way to do the same job, and the wider item picker already lets you search.

## Hiện trạng: Phiếu nhập (Task 1)

1. **States.** The form has three states:
   - new (`/admin/inventory/purchase-orders/new`);
   - editing a draft;
   - editing a completed order (`isEdit`, `po.status`).

   On a phone a line is open (fields showing) or closed (a `PhoneRow` summary), controlled by `openIndex` and `errorIndex`. On a computer every line is open. None of this changes.
2. **Buttons.**
   - "+ Thêm mặt hàng đầu tiên" (empty list) and "+ Thêm mặt hàng" add an empty line.
   - ✕ (computer) and "Xoá dòng" (phone) remove a line.
   - "Xong" (phone) closes a line.
   - "Thuế, chiết khấu, ghi chú" folds open more fields, and is disabled while one of them has a value.
   - The footer has three buttons:
     - "Bỏ" or "Bỏ thay đổi";
     - "Lưu nháp", hidden when editing a completed order;
     - "Tạo" or "Cập nhật & Hoàn thành".

   No button is added or removed.
3. **Lists.**
   - The item picker lists `items` as the page loads them.
   - The unit list is that item's conversions with status not `INACTIVE`.

   Neither changes.
4. **Inputs.**
   - Số lượng: 3 decimals.
   - Thành tiền: 0 decimals.
   - Phí vận chuyển, Voucher, Thuế, Chiết khấu: 0 decimals; empty means 0.
   - Ngày nhập hàng thực tế: blank means the time of saving.
   - Mã hoá đơn, Ghi chú: free text.

   Validation (`validatePurchaseOrderHeader`, `validatePurchaseOrderLine`) does not change. A failing line gets an alert and a red border on its card (`PurchaseOrderLines.tsx:87-89`). There is no inline error text.
5. **Data.** Orders with 1 to many lines. Measured 2026-10-17: 207 orders, 1.8 lines on average, 11 at most. The page rarely scrolls, so nothing needs to stay pinned.

Extra questions:

6. **Widths.** Width inside the lines card = window − sidebar (272 px open, 76 px collapsed; `AdminSidebar.tsx:51-52`) − page padding (64 px from lg; `app/admin/layout.tsx:120`) − card padding (48 px). The content is capped at 1280 px.
   - A 1024 window gives about 640 px with the sidebar open.
   - A 1280 window gives about 896 px.

   The table template has about 564 px of fixed columns, so **the table starts at `xl` (1280)**. From 768 to 1279, each line stays a card with two rows:
   - row 1: the item picker, then ✕;
   - row 2: unit, quantity, subtotal and unit price in four columns.
7. **Is the money in view?** At 1280×800 with 3 lines, the money block starts within one short scroll, and the footer stays where wave 1 put it. At 1024×768 the same holds with card rows.

## Hiện trạng: Phiếu xuất (Task 2)

1. **States.** There is one state, new (`/admin/inventory/issue-slips/new`). The desktop block (`IssueSlipClient.tsx:262-418`) and the phone view (`md:hidden`, line 421) are separate markup. Only the desktop block changes.
2. **Buttons.**
   - "+ Thêm mặt hàng" adds a line.
   - ✕ removes a line, and shows only when there is more than one line.
   - The footer has "Bỏ" and "Ghi phiếu xuất (n dòng)".

   None of these change.
3. **Lists.** The item picker lists `itemOptions`, and the unit list lists that item's options. Neither changes.
4. **Inputs.**
   - Thời điểm xuất: a date and time. A past date shows the "Ghi lùi ngày" warning.
   - Số lượng: 3 decimals, `min=0`.

   "Tồn hiện tại", "Quy ra" and "Giá trị xuất" are read-only cells, and "Đã điền đủ x/y dòng" is a count. None of this changes.
5. **Data.** Slips with 1 to many lines. Example ISL-00102 (2026-10-15 12:14) has two lines:
   - ISS-00240: Sữa đặc La rosee, 1,000 in base unit;
   - ISS-00239: Xốt caramel Golden Farm, 630.

Đã xem:
- `PurchaseOrderForm.tsx`: layout 315–508 and line logic 192–238.
- `PurchaseOrderLines.tsx` and `PurchaseOrderTotals.tsx`, in full.
- `IssueSlipClient.tsx` desktop block 258–420.
- `components/ui/Table.tsx`: `TableHeaderCell` has no `className` prop. It is `whitespace-nowrap md:whitespace-normal`.
- `SearchableSelect.tsx` trigger: `min-w-0 line-clamp-2`, so long names wrap to two lines.
- The tests the critique listed.

Chưa xem:
- the Phiếu xuất phone view;
- `IssueSlipEditLines.tsx` (the edit page, out of scope).

## Worked example (real data, read-only query 2026-10-17)

Phiếu nhập PO-207, 2026-10-16 13:00, supplier "Không rõ", paid cash:

| Dòng | Mặt hàng | Đơn vị | Số lượng | Thành tiền | Đơn giá |
|---|---|---|---|---|---|
| POL-bfea42d1… | Túi đựng muối tiêu | g | 200 | 24,000đ | 120đ |
| POL-48744cf1… | Túi đựng khoai | g | 100 | 6,000đ | 60đ |
| POL-2e378961… | Khoai lang | kg | 5 | 75,000đ | 15,000đ |

Tổng tiền hàng 105,000đ, no fees, Cần thanh toán 105,000đ.

**Hard case.** Add a line for "Găng tay thực phẩm nitrile Hygi Kitchen and Food, size 90-100mm", the longest active name (63 characters, measured 2026-10-17). Give it quantity 3, Thành tiền 100,000, and no unit. Expected:
- The name wraps to two lines in the picker.
- Đơn giá reads "33,333đ". The same rounding as the phone row (`Math.round`, `PurchaseOrderLines.tsx:100`).
- The unit shows "-- Chọn --".

**At 1280×800 after the change:**
- The four order fields sit in one row at the top.
- Each line is one table row under a single header row.
- Under the table, Hình thức thanh toán is on the left and the totals card is on the right, ending "Cần thanh toán: 205,000đ" (105,000 + 100,000).

**Phiếu xuất ISL-00102 at 1280:**
- "Thời điểm xuất" and "Đã điền đủ" sit in one strip at the top.
- The table's seven headers sit on one line each.
- "Xốt caramel Golden Farm" shows in full in the picker.
- The total sits under the table on the right.

## Global constraints (copy into the brief)

- **One set of inputs per line on Phiếu nhập.** Do not render a second desktop-only copy of any input or button. The table look comes from CSS on the same elements:
  - one column-header row, `hidden xl:grid`, `aria-hidden="true"`;
  - each line's grid uses the same template from xl;
  - the plain `<label>`s in `PurchaseOrderLines.tsx` become `xl:sr-only`;
  - row borders replace card boxes from xl;
  - ✕ is never `absolute`.
- **Phone unchanged.** Every new desktop class carries an `md:`, `lg:` or `xl:` prefix. Phone parts that tests select stay exactly as they are:
  - the collapsed phone button stays the first `md:hidden` element in the card, with `w-full text-left`;
  - the phone action row stays `flex md:hidden`.
- **Test IDs stay:** `form-layout`, `form-shared`, `form-lines`, `form-money`, `po-line-card`. The DOM order stays shared → lines → money.
- **Sizes, money and words.**
  - Box heights follow BR-UI-014.
  - Money uses `formatNumber` plus "đ" (BR-UI-008).
  - All words on screen are Vietnamese.
- **Do not change** shared components (`components/ui/*`), `FormActionBar`, or the admin layout.
- **No popups** (BR-DATA-007).

## Review focus

1. **1024×768**, with the sidebar open and with it collapsed:
   - card rows, with no sideways scroll on either page;
   - the item picker at least 160 px wide;
   - on Phiếu xuất, the table may scroll sideways inside its own frame (`Table.tsx:42`, `overflow-x-auto`) but the page must not.
2. **A failing line on a computer** keeps a visible red border in the table look. Keep the literal class `border-danger` (the test at `PurchaseOrderForm.test.tsx:1262` selects `.border-danger`).
3. **Editing a completed order:** "Lưu nháp" is absent and nothing else moves.
4. **An item with no active conversion:** the unit cell shows its empty state and the row height does not jump.
5. **Restoring a draft (`?draft=1`):** the restored lines render as table rows with their values.

## Task 1: Phiếu nhập

**Files:**
- `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx`: the layout block (323–455) and the date placeholder only.
- `app/admin/inventory/purchase-orders/components/PurchaseOrderLines.tsx`
- `app/admin/inventory/purchase-orders/components/PurchaseOrderTotals.tsx`
- `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.test.tsx`

**Steps:**

1. **Layout**
   - `form-layout` becomes `grid grid-cols-1 gap-6` on every width, in the order shared, lines, money. Remove every `lg:col-*` and `lg:row-*` from the three blocks.
   - `form-shared`:
     - Swap `space-y-4` for `grid gap-4 md:grid-cols-2 xl:grid-cols-4`. `space-y` adds a top margin to grid children.
     - The `h3` gets `md:col-span-full`. Drop its `mb-3` if the gap already spaces it.
   - The date placeholder becomes "ngày/tháng/năm". The hint stays.
2. **Lines** (`PurchaseOrderLines.tsx`)
   - Add one header row, `hidden xl:grid` with `aria-hidden="true"`, using the same template and gap as the rows. Its cells are:
     - "Mặt hàng"
     - "Đơn vị nhập"
     - "Số lượng"
     - "Thành tiền (đ)"
     - "Đơn giá"
     - an empty cell for ✕
   - The row grid (line 119) changes:
     - Swap `md:grid-cols-12` and every `md:col-span-*` for `md:grid-cols-4 xl:grid-cols-[minmax(0,1fr)_9rem_6rem_8rem_6rem_2.5rem]` with `gap-3`.
     - The item cell is `md:col-span-4 xl:col-span-1` and sits together with ✕ in row 1 from md to xl.
     - Put ✕ in the grid as its own cell: `md:` placed at the end of row 1, last column from xl. Choose the simplest markup that keeps one ✕ element.
     - Remove `absolute top-4 right-4` from ✕ (line 114).
   - The labels at 123, 138, 174, 198 and 219 get `xl:sr-only`. Keep the label "Đơn giá" directly before its value `div`: the test at 557–584 reads `nextElementSibling`.
   - The card (line 87) gets `xl:rounded-none xl:border-x-0 xl:border-t-0 xl:p-0 xl:py-2 xl:bg-transparent`. It keeps `border-danger` when `errorIndex` matches.
   - The wrapper (line 59) gets `xl:space-y-0`.
   - The Đơn giá value cell gets `xl:flex xl:items-center` and shows `formatNumber(Math.round(unitPrice))` followed by "đ".
   - The empty state and "+ Thêm mặt hàng" stay. After "+ Thêm mặt hàng", the new line's item picker gets focus, but only if `SearchableSelect` can take focus without a new prop. If it cannot, skip this and say so.
3. **Money** (`PurchaseOrderTotals.tsx`)
   - The component returns three siblings: the `h3` (66), the totals card (67) and the payment `div` (160).
   - Wrap them in one `div` with `lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start`.
   - Put the `h3` and the card together in one `div`, and keep the payment `div` after it. This keeps today's phone order.
   - Give the payment `div` `lg:order-first`, so on a computer it sits on the left. The keyboard then visits the totals before payment, which is acceptable: the totals come first when reading the form.
   - Inside the grid, the children lose their `mb-6` (`lg:mb-0`).
   - Do not change the fold's `space-y-2` or `hidden`, or the toggle's height classes. Tests at 898–902, 1635 and 1654–1655 use them.
   - "Tổng tiền hàng" and "Cần thanh toán" gain "đ".
4. **Tests** (write first)
   - Replace "on a computer: lines on the left two thirds…" (627–640). The new test asserts:
     - `form-layout` has no `lg:grid-cols-3`;
     - `form-shared` has `xl:grid-cols-4`;
     - all three blocks are inside `form-layout`, in the order shared, lines, money.

     Reason: the old test pins the two-column layout that this plan removes.
   - Update 557–584. "Đơn giá" now appears twice, once in the header and once on the line. Take the one inside `po-line-card`. This change is expected.
   - Add: one `aria-hidden` header row containing "Mặt hàng" and "Đơn giá".
   - Add: quantity 3 and subtotal 100000 show "33,333đ".
   - Add: quantity 5 and subtotal 75000 show "15,000đ" on the line and "75,000đ" in the totals card.
   - Keep every other test. If one other than 557–584 fails, report it. Do not change its query.

## Task 2: Phiếu xuất

**Files:**
- `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx`
- `app/admin/inventory/issue-slips/components/IssueSlipClient.test.tsx`

**Steps:**

1. **Layout, desktop block.**
   - `form-layout` becomes `grid grid-cols-1 gap-6`. Remove the `lg:col-*` and `lg:row-*` classes.
   - `form-shared` is one strip on md+: the "Thời điểm xuất (áp dụng cho cả phiếu)" box (about 20rem) and "Đã điền đủ" side by side. Remove the `border-t` that only made sense when stacked.
   - `form-money` sits under the table, right-aligned: `md:ml-auto md:w-full md:max-w-sm`.
2. **Columns.** Give the unit and quantity cells a minimum width (about 9rem and 8rem) through a `div` inside the cell. `TableHeaderCell` takes no `className`, and the shared Table must not change. The item cell takes the remaining width.
3. **Date box.** Remove the `className` passed to `SaigonDateTimeInput` at lines 279 and 431, so the box takes wave 1's shared look. The phone view's line 431 is a class removal only.
4. **Tests.** Update "lines on the left two thirds, the issue time then the total and buttons on the right third" (985–1010):
   - The `lg:` class assertions become: `form-layout` has no `lg:grid-cols-3`.
   - The DOM order, the text, `table`, the single test IDs, and `closest(".md\\:hidden")` being null all stay.

   Reason: the two-column layout is removed. Do not add a `whitespace-nowrap` test; the shared header cell already has it on phone, so such a test would prove nothing.

## Done when

- The five project checks pass.
- Playwright checks the worked example at:
  - 1920×1080;
  - 1280×800;
  - 1024×768, with the sidebar open and collapsed;
  - 390×844 and 360×780.
- The phone shots look as they did before.
- Both pages have no sideways page scroll at any of those widths.
