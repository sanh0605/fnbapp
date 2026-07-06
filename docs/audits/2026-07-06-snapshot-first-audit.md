# Audit: Snapshot-first lookup (POS cart, dashboard, reports)

Date: 2026-07-06

## Goal
Verify all places displaying historical data (past orders, receipts, historical reports) use the order line snapshot (`product_snapshot_json`) instead of querying the current product catalog, avoiding data drift when prices or names change.

## Audit Findings

1. **`components/pos/CartPanel.tsx` (Processing Overlay)**
   - **Status**: Fixed.
   - **Details**: The display used `item.product_name || matchedProduct?.name`. If catalog drifted, the fallback could mask the issue or show incorrect data. I removed `matchedProduct` entirely. The processing overlay now relies 100% on the snapshot (`item.product_name`).

2. **`components/pos/CartItemRow.tsx` (Live Cart Item)**
   - **Status**: Correct, no change needed.
   - **Details**: Display names already use `item.product_name`. The catalog lookup `currentProduct` is strictly passed to `openProductModal(currentProduct, idx)` so the modal can show available modifiers/sizes for editing from the live catalog. This is the correct behavior for a live cart.

3. **`app/admin/page.tsx` (Dashboard Cup Counts)**
   - **Status**: Deferred (per prompt).
   - **Details**: Counts cups sold in topping category using current catalog `category_id`. Since the dashboard filters for today/yesterday, cache drift is minimal.

4. **`app/admin/reports/sales/page.tsx` & `actions.ts` (Reports)**
   - **Status**: Correct, no change needed.
   - **Details**: The allocator `breakdownRevenueByProduct` already correctly uses `productSnap.name` directly from the `product_snapshot_json`. The lookup `products.find(x => x.id === item.product_id)` in `page.tsx` is purely used to fetch `category_id` to categorize the display into Foods vs Drinks, which is acceptable since the category isn't captured in the snapshot structure. Product names rendered in the UI are definitively snapshot-based.

## Conclusion
The application correctly embraces the snapshot-first pattern for historical data. The single instance of an unnecessary catalog fallback in `CartPanel.tsx` has been eliminated.
