# Order Management Audit - Design Spec

Date: 2026-06-04
Approach: Incremental upgrade, keep current architecture (Google Sheets DB)

## Overview

Nang cap toan dien chuc nang quan ly don hang: sua bug, them filter/tim kiem, xem chi tiet, va sua don hang.

## Part 1: Bug Fixes & Stability

### 1.1 Fix `order_no` return value

**File:** `app/actions/pos.ts:163`
**Bug:** `return { success: true, order_no }` references undefined variable.
**Fix:** Change to `return { success: true, order_no: final_order_no }`

### 1.2 Duplicate order number prevention

**Current behavior:** Count row positions to generate sequential number. Race condition possible.

**Fix:** After generating `final_order_no`, check if it already exists in Orders sheet. If duplicate, increment until unique.

**File:** `app/actions/pos.ts` - add duplicate check after line ~62.

```pseudo
let final_order_no = generate(brandCode, previousCount)
while (allOrdersAfter.some(o => o.order_no === final_order_no)) {
  previousCount++
  final_order_no = generate(brandCode, previousCount)
}
```

### 1.3 Success UX improvement

**Current:** `alert()` for success/error.
**Fix:** Replace with a styled success modal showing order number prominently + "Tao don moi" button.

**File:** `components/POSScreen.tsx` - replace alert with modal component state.

## Part 2: Order Filtering & Search

**File:** `app/admin/orders/OrderTable.tsx`

Add filter bar above the table with:

| Filter | Type | Behavior |
|--------|------|----------|
| Search | Text input | Filter by display_order_no (partial match) |
| Date range | Two date inputs | Filter by created_at range |
| Payment method | Dropdown | All / Cash / Transfer |
| Brand | Dropdown | All brands / individual brand |

All filtering is client-side (data already loaded from server).
Preserve existing pagination (20 items/page).

## Part 3: Order Detail View

**New component:** `app/admin/orders/OrderDetailModal.tsx`

Modal triggered by clicking on an order row. Shows:

- Header: Order number (large), creation time, payment method, brand name
- Line items table: Product name, size, qty, unit price, modifiers (+price), line total
- Discounts: Per-item discounts, order-level discount
- Totals: Subtotal, discount amount, total
- Action buttons: Edit order, Delete order

## Part 4: Order Editing

### Scope

Allow editing completed orders:
- Add/remove items
- Change item quantity
- Change item size (variant)
- Add/remove modifiers
- Change item discount / order discount
- Change payment method

### Architecture

**New file:** `app/actions/order-edit.ts`

Server action `editOrder(orderId, editData)`:

1. Read current order + lines from DB
2. Validate order exists
3. Delete old Order_Lines
4. Insert new Order_Lines from editData
5. Handle stock recalculation:
   - Delete all `SALES_CONSUME` Stock_Ledger entries for this order
   - Recalculate stock consumption using recipe valid at `order.created_at`
6. Update Orders record (total, subtotal, discount, method)
7. Revalidate cache

### Recipe Lookup Logic

When recalculating stock for an edited order:

**Priority 1:** Recipe where `end_date > order.created_at`
**Fallback:** Recipe where `end_date` is empty/null

This ensures stock movements match the recipe that was actually in effect when the order was created.

### Edit UI

**New component:** `app/admin/orders/OrderEditModal.tsx`

Similar layout to POSScreen cart editing but in modal form:
- List of current items with edit/remove buttons
- Add item button (opens product selector)
- Each item shows: product, size, qty, modifiers, discount
- Order-level discount and payment method at bottom
- Save / Cancel buttons

### Stock Recalculation Flow

```
1. Read order.created_at
2. Delete Stock_Ledger where reference_id = orderId AND transaction_type = "SALES_CONSUME"
3. For each new order line:
   a. Lookup recipe (variant recipe + modifier recipes)
      - Filter: end_date > order.created_at (priority)
      - Fallback: end_date empty
   b. Skip non-inventory base ingredients
   c. Create new Stock_Ledger entries with recalculated quantities
4. Update Orders record with new totals
```

## Files Modified

| File | Change |
|------|--------|
| `app/actions/pos.ts` | Fix order_no bug, add duplicate check |
| `components/POSScreen.tsx` | Replace alert with success modal |
| `app/admin/orders/OrderTable.tsx` | Add filters, search, click-to-detail |
| `app/admin/orders/page.tsx` | Pass brands data for filter |

## Files Created

| File | Purpose |
|------|---------|
| `app/admin/orders/OrderDetailModal.tsx` | Order detail view modal |
| `app/admin/orders/OrderEditModal.tsx` | Order edit modal |
| `app/actions/order-edit.ts` | Server action for editing orders |

## Constraints

- Google Sheets as DB (no real transactions)
- Orders auto-COMPLETE on creation (no status flow)
- All filtering client-side
- Recipe lookup uses historical validity (end_date > order.created_at)
