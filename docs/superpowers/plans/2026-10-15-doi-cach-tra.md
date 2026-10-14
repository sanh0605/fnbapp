# Đổi cách trả: plan

Rule: `BR-SALE-014` (owner 2026-10-15, "Chỉ đổi cách trả"). Proposal: `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`. This changes an existing screen, so the design is short and lives here.

## Hiện trạng (measured 2026-10-15)

1. **States.** An edit makes a new order row. The new row has version+1 and the same order number and sale time. The old row becomes SUPERSEDED, and an EDITED event is written. This model stays.
2. **Buttons.**
   - The order page has "Sửa đơn" (`app/admin/orders/[id]/components/OrderDetailView.tsx:211-215`). It opens `app/admin/orders/[id]/edit/`, a full cart editor:
     - lines through `LineItemEditor.tsx`;
     - an add-dish panel;
     - a whole-order discount through `DiscountEditor.tsx`;
     - payment parts (`BR-SALE-013`);
     - a reason box.
   - The new design keeps only the payment parts, the reason, "Lưu" and "Bỏ".
3. **Lists.** The page lists the order's lines as editable rows. They become a read-only summary: dish, size, toppings, quantity and line money, exactly as sold.
4. **Inputs.**
   - Payment parts: Tiền mặt / Chuyển khoản. Each method appears at most once. One part takes the whole total. With two parts, each must be a whole number above 0 and the two must add up to the order's total, or the save is refused with both figures shown. The existing messages in `lib/sales/order-edit-cart.ts:36-65` stay.
   - Reason: required, as today.
   - The order's total cannot be changed.
5. **Data served.**
   - Only COMPLETED orders: the page already returns not-found otherwise.
   - Cố ý không phục vụ: a change of dish, quantity, price or discount. That is Huỷ đơn plus ringing the order again at the till.

Measured history:
- 25 edits: 18 payment-only, 5 tests, 2 content.
- 6 orders lost their seller to "admin".
- 3 lost their promotion link.

Real example the server must reproduce:
- Order 260717002011 was sold by tuyen2612. On 2026-07-17 it was edited from 49,000 to 59,000 and now reads "admin".
- Under this design, changing its payment from Tiền mặt to Chuyển khoản would give a new version with these unchanged: seller tuyen2612, every line's dish, price and snapshot, `applied_promotion_id`, and the 59,000 total.
- The editor's name goes only into the EDITED event.

Extra questions for this change:
- **Double submit:** `supersede_order_v2_atomic` already locks the row and checks the version (0081:74-87).
- **Paused dish:** today an order holding a paused dish cannot be edited even to change payment (`order-cart.ts:337-341`). The copy path never reads the catalog, so this goes away.
- **English errors:** the new action returns Vietnamese only, including "not found" and the version clash ("Đơn vừa được người khác sửa, tải lại trang").

## Design

- **Server** (`app/admin/orders/order-edit-actions.ts`): `editOrderV2` is replaced by
  `changeOrderPayments(input: { orderId: string; expectedVersion: number; payments: unknown; reason: string }): Promise<{ success: true; new_order_id: string } | { success: false; error: string }>`.
  It works as follows:
  - Requires ADMIN (`requireAdmin`, as today) and a non-empty reason.
  - Loads the old order, its lines and its payments.
  - Copies the old order row unchanged into a new row, except:
    - new id;
    - version+1;
    - parent = the order being replaced (required by supersede_order_v2_atomic, 0081:101);
    - `payment_method` = the first part's method, as the till does (`order-cart.ts:181,208`).

    Seller (`created_by_*`), promotion, totals, outlet, brand and sale time are copied.
  - Copies each line unchanged, with a new id and the new order id.
  - Plans payments with `planRequestedPayments(payments, old net_total)`.
  - Writes through `supersedeOrderV2`, with an EDITED event whose actor is the editor, `delta_json` holding the old and new payment parts, and the reason.
  - Delete `buildEditedOrderFromCart`, the unused branch of `planEditedOrderPayments`, and `suppress_auto_promotion` in `order-cart.ts` (its only user is the edit path).
- **Screen** (`app/admin/orders/[id]/edit/`):
  - Title "Đổi cách trả".
  - Read-only lines as sold, the total, the payment-part editor, reason, "Lưu" and "Bỏ".
  - Desktop: summary on the left, payment form on the right. Phone: stacked.
  - Delete `LineItemEditor.tsx`, `DiscountEditor.tsx`, their tests, and the add-dish part of `OrderEditForm.tsx`.
  - The page no longer loads products, variants, options or groups.
  - On the order page, the button "Sửa đơn" becomes "Đổi cách trả".

## Tasks

1. **Sonnet:** server action and tests, red first.
   - Cases:
     - payment switch keeps seller, promotion, lines and total;
     - two-part sum mismatch is refused;
     - missing reason is refused;
     - version clash gives the Vietnamese message;
     - an order with a paused dish can still change payment.

   Then delete the dead functions.
2. **Gemini** (parallel; files do not overlap): the screen, using `changeOrderPayments` with the signature above.
3. **Opus:**
   - review both;
   - turn the `BR-SALE-014` `it.todo` into a green test;
   - run the five gates;
   - check the page in the browser on desktop and phone width.
4. **Separate, needs the owner's approval to run:** restore the seller on the 6 orders and the promotion link on the 3, with `fnbapp-bulk-data-change`.
