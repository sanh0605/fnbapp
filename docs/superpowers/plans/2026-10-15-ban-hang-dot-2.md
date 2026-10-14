# Bán hàng, đợt 2: kỹ thuật không cần chủ quán quyết

Proposal and design: `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md` (section "Technical work", the Huỷ đơn page design, and Q2, Q5, Q6, Q8 as answered 2026-10-15). Audit details are cited there.

## Hiện trạng

1. **States.**
   - Orders: COMPLETED, SUPERSEDED, VOIDED. The list shows COMPLETED only, so voided orders cannot be found.
   - Outlets: ACTIVE, INACTIVE. "Ngừng hoạt động" is one-way today; `BR-SALE-006` (2026-10-15) now allows reopening.
   - Topping options: deleting one that has a standalone dish marks only the option DELETED. The dish stays on the till.
2. **Buttons.**
   - Huỷ đơn opens a popup with a typed reason, which breaks `BR-DATA-007`. It becomes a page.
   - A stopped outlet gets "Mở lại hoạt động". It is shown only when the outlet is INACTIVE, to ADMIN and MANAGER (the same people as "Ngừng hoạt động").
   - Xoá on a topping option whose dish is ACTIVE is refused with the dish's name.
3. **Lists.**
   - Order list: a "Trạng thái" select, Hoàn tất (default, as today) or Đã huỷ. A voided row shows the "Đã huỷ" badge and its reason. The total row keeps leaving voids out (`BR-UI-004`).
   - Loại món opens sorted by code, descending (`BR-DATA-008`, Q2). Nhóm tuỳ chọn keeps "Thứ tự hiện": its spec decided that.
4. **Inputs.**
   - The payment filter reads only the ids of orders with two or more payment rows. Every other order is matched by `orders_v2.payment_method`. Measured 2026-10-15: 2 split orders. Today the filter sends up to 1,364 ids in the address and its read stops at 1,000 rows.
   - The Huỷ đơn reason is required; blank or spaces only is refused in Vietnamese.
   - "Ngày áp dụng giá" leaves the dish form (Q8). The price history row takes the save time.
5. **Data.**
   - Serves the order pages, the menu catalog pages and the outlet pages.
   - The till: only the product brand filter goes (Q6, `BR-CATALOG-006`). `products.brand_id` is empty on 48 of 48 dishes (2026-10-15), so the till shows the same dishes before and after.
   - Deliberately not served here:
     - promotion pricing (C10);
     - the column drops (the structure batch);
     - the data writes (each needs owner approval). Data write 2 gets a dry run only.

Own questions:

- **Can this stop the till?** No. Ticket A3 found that the till never filtered dishes by brand. The `brand_id` checks in `POSScreen.tsx` (~305, ~434) and `order-cart.ts` `resolvePromotion` are promotion checks, and they stay. So A3 changes no till code; it only pins `BR-CATALOG-006` with a till test and a server cart test. Correction 2026-10-15: this plan first named those lines as a dish filter.
- **Who may reopen an outlet?** The same role check as the existing deactivate action.
- **Does reopening keep order numbers continuous?** Yes. The code is unchanged and minting counts per outlet and day (`BR-SALE-006`).

## Design (short)

- **Huỷ đơn page** `/admin/orders/[id]/void`:
  - Copies `app/admin/inventory/purchase-orders/[id]/cancel/`: `DetailHeader` back to the order, then a summary on the left (code, time, dishes, Khách trả). On the right: the reason box, "Xác nhận huỷ" and "Quay lại".
  - It calls the existing `voidOrderV2`; on success it goes to the order page.
  - Phone: one column, summary first.
  - A VOIDED or SUPERSEDED order shows "Đơn này không huỷ được" and a back link.
  - `VoidOrderButton` becomes a link to that page.
- **Vietnamese refusals** at the action boundary: "Không tìm thấy đơn" and "Đơn này không còn huỷ được".
- **Cleanup.** No behaviour change; each item was measured dead in the audit:
  - the "#" order-code branch;
  - the catalog reads `OrderTable` ignores;
  - the duplicate Brands read;
  - `ToppingsManager` and the `/admin/products/toppings` redirect;
  - unused `canDelete` props;
  - the `effective_date` read;
  - six private copies of `safeReturnTo`.
- **Speed.** Tạo món loads only the groups; Sửa món loads one dish (`loadProductRow`). The Món list stops building price history per row.
- **Display.** Option detail shows "Có sẵn" and "Tối đa mỗi món". Nhóm món shows its Loại món. Dish detail shows its option groups.
- **Template.**
  - Order list: `ListPageHeader` (group "Bán hàng") and `ListPagination`; the "N / M" chip goes; "Xoá lọc" moves into the filter bar.
  - Column "Khách trả"; 13 px cells; search hint "Ví dụ: 261012001030"; `formatDateTimeFull`.
  - Event names: Tạo, Sửa, Huỷ, Chuyển dữ liệu cũ.
  - `Badge` and `Alert`.
  - The five catalog create pages move onto `DetailHeader`.
  - Dish form errors show inline, not as `alert()`.

## Tickets

Each wave runs in parallel; no two tickets in a wave share a file.

**Wave 1 (Sonnet):**
- **A1 orders backend.** Files: `app/admin/orders/actions.ts`, `order-detail-actions.ts`, `order-void-actions.ts`, `[id]/page.tsx`, and their tests. Work:
  - payment filter;
  - `status` filter param (`COMPLETED` default, `VOIDED`), returning the void reason;
  - Vietnamese errors;
  - "#" branch and duplicate Brands read.
  - The unused catalog reads stay until wave 2, because `OrderTable` still declares them.
- **A2 catalog backend.** Files: `app/admin/products/actions.ts`, `load-product-rows.ts`, `modifiers/actions.ts`, `toppings/**`, `categories/actions.ts`, `new/page.tsx`, `[id]/edit/page.tsx`, the `safeReturnTo` copies in `types/[id]`, `types/[id]/edit`, `modifier-groups/[id]` and `modifier-groups/[id]/edit`, `nav-allowlist.ts`, `components/ui/template.guard.test.ts`, and tests. Work:
  - refuse deleting a linked option while its dish is ACTIVE;
  - move `toggleToppingStandalone` into `modifiers/actions.ts` and route it through `setProductStatusAtomic`;
  - delete `ToppingsManager` and the toppings route;
  - load less on Tạo/Sửa món;
  - stop reading `effective_date`;
  - Nhóm món duplicate-name check (`findDuplicateActiveName`, as Loại món).
- **A3 outlets and till.** Files: `app/admin/outlets/actions.ts` and test, `app/pos/components/POSScreen.tsx` and test, `lib/sales/order-cart.ts` and its test. Work:
  - `reactivateOutlet`;
  - drop the product brand filter, turning the two `it.todo` into tests.
- **A4 data write 2, dry run.** File: one new script in `scripts/`, via skill `fnbapp-bulk-data-change`.
  - Restore `created_by_*` from the first version on the 6 orders, and the promotion link and snapshot on 3.
  - Dry run only; it prints rows before and after.

**Wave 2 (Gemini, after wave 1):**
- **B1 orders UI:**
  - Huỷ đơn page;
  - Trạng thái select;
  - template pass on the list, detail and void pages;
  - remove the ignored catalog props from `OrderTable` and `page.tsx`, along with the reads in `getOrdersV2`, which Opus deletes after.
- **B2 catalog UI:**
  - remove the date field and `canDelete` props;
  - display additions;
  - create pages onto `DetailHeader` (using the shared `safeReturnTo` in `types/new` and `modifier-groups/new`);
  - dish form inline errors;
  - 7 red boxes onto `Alert`;
  - Loại món default sort.
- **B3 outlets UI:** the "Mở lại hoạt động" button on the outlet detail page.

Checks after each wave: the five gates (tsc, vitest, the two doc checks, and a build in a throwaway worktree). After wave 2, the pages are opened at 1366 and 390 px. Opus reviews every diff, including for excess code (ponytail).

Seen: the four audit reports; `order-void-actions.ts`; the purchase-order cancel page; outlet actions and their tests; the till's `brand_id` uses; `BR-DATA-008`; the Nhóm tuỳ chọn spec's sort order. Not seen: `OrderTable.tsx` and the catalog pages in full (the tickets read them); whether `orders_v2` has a void-reason column (A1 checks `information_schema`).
