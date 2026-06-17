# Combo Bug Root Cause Report

## Customer Charge Math (Sub-Task 1)

| order_no | gross | sum(line_discount) | order.discount_amount | total_amount | actual_received | actual_discount | matches_formula |
|---|---|---|---|---|---|---|---|
| UCK000150 | 18000 | 3000 | 3000 | 15000 |  | 3000 | BOTH (DUPLICATE) |
| UCK000151 | 359000 | 157000 | 157000 | 202000 |  | 157000 | BOTH (DUPLICATE) |
| UCK000152 | 54000 | 24000 | 24000 | 30000 |  | 24000 | BOTH (DUPLICATE) |
| PHD000505 | 36000 | 6000 | 6000 | 30000 |  | 6000 | BOTH (DUPLICATE) |
| PHD000522 | 26000 | 6000 | 6000 | 20000 |  | 6000 | BOTH (DUPLICATE) |

**Verdict: PHANTOM DUPLICATE.** Customers are charged correctly (Gross - Discount), but the discount value is recorded twice: once in `Order_Lines.line_discount` and once in `Orders.discount_amount`.

## Code Root Cause (Sub-Task 2)

### Smoking Gun 1: Duplicate Discount Recording
- **File**: `components/POSScreen.tsx`
- **Lines**: 441-489 (`finalCart` mapping) and 492-506 (`orderData` construction).
- **Explanation**: Commit `122a6338` modified the `finalCart` mapping to add `promoItemDiscount` to `lineDiscount` REGARDLESS of whether a manual order discount is active. However, if a cashier interacts with the checkout modal, `userCustomDiscount` becomes non-null, and that same value is sent in `orderData.discount_amount`. The backend `pos.ts` blindly writes both values to the sheet.

### Smoking Gun 2: Pre-fill Loophole
- **File**: `components/POSScreen.tsx`
- **Lines**: 383-401 (`handleCheckoutClick`) and 920-960 (`CheckoutModal`).
- **Explanation**: When the checkout modal opens, it pre-fills the input with `promoDiscountAmount`. If the cashier clicks the VND/% toggle or types anything, `userCustomDiscount` is set to that value. This triggers the "Combo" state where the same discount is applied at both line and order level in the payload.

## Subtotal=0 Cause (Sub-Task 3)

**Root Cause: Next.js Server Cache Mismatch.**
- I added the `subtotal` column to the Google Sheet using a standalone script (Phase 5). 
- The Next.js server running the app uses `unstable_cache` for `getHeaders` in `lib/sheets_db.ts`.
- Because the standalone script did not invalidate the server cache, `insert()` in `app/actions/pos.ts` is still using the OLD header list (16 columns) which lacks `subtotal`.
- `mapObjectToRow` (lib/sheets_db.ts:61) iterates over these cached headers and silently drops the `subtotal` key from the record before writing.
- **Introducing Commit**: None (Infrastructure/Cache issue after manual schema repair).

## Regression Scope (Sub-Task 4)

- **Bug 1 (Duplicate Discount)**: Introduced by `122a6338` ("fix(pos): preserve PRODUCT_DISCOUNT promo under manual order discount"). This commit was too broad; it preserved the line discount but failed to zero out the order discount when they are the same.
- **Bug 2 (Missing Subtotal)**: Affects all orders since the `subtotal` column was added (~24 hours ago), due to the cache not being cleared on the running server.

## Admin Edit Path (Sub-Task 5)

- **File**: `app/actions/order-edit.ts`
- **Analysis**: The admin edit path uses `subtotal: subtotal_amount`. It will also suffer from the Subtotal=0 cache bug until the cache is cleared.
- **Combo Pattern**: Admin edit explicitly sets `applied_promotion_id = ""` (Line 189), so it creates "Empty Promo" combos. However, PHD000522 was NOT an admin edit (empty `discount_reason`).

## Open Questions for Claude

1. How should we force-clear the `unstable_cache` for headers on the production server? (A server restart or a temporary script calling `revalidateTag` inside a Next.js API route may be needed).
2. Should we revert `122a6338` or refine it to only apply `line_discount` if `order.discount_amount` is 0?

## Recommended Fix Direction

1. **POS Logic**: In `POSScreen.tsx`, if `appliedPromo.type === "PRODUCT_DISCOUNT"`, the checkout modal should either (a) disable manual discount editing or (b) if manual discount is edited, it must override (zero out) the line-level promo discounts to prevent duplication.
2. **Cache**: Trigger a `revalidateTag` for all sheets within the Next.js environment to sync the new headers.
3. **Data Repair**: Run a script to backfill the missing `subtotal` and zero out `order.discount_amount` for the 37 duplicate orders.
