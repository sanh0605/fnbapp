import { allocatePurchaseOrderCost } from "@/lib/purchase-order-cost-allocation";
import type { Purchase, Issue } from "@/lib/issue-costing";

// Plan C Task 2. There is nothing to reuse here -- the loader this plan
// originally pointed at would have been written by Plan B Task 4, and the
// owner cancelled that task, so computeIssueCosting has had no real caller
// until this one. Follows the convention Plan B Task 1 pinned: join
// purchase_order_lines to purchase_orders (the line table carries no status
// column of its own), filter status = 'COMPLETED', and take `at` from
// transaction_date with created_at as fallback -- 57 of 62 completed orders
// were entered on a different day from the one they happened.
//
// BR-COGS-006 (Plan D D11): a line's raw subtotal is not what was paid for
// it. Shipping, tax, vouchers, and discounts live only on the order header
// and reach no line unless allocated explicitly -- found when the owner
// refused a stocktake-projected purchase total that was 3.623.494đ (7,4%)
// too high, across the board. Grouped by order here (not per-line) so
// allocatePurchaseOrderCost runs once per order, the shape it expects. The
// adjusted figure is derived at read time, same as every other issue-
// costing input -- never persisted.
//
// Plan G G1: extracted from app/admin/reports/actions.ts (the only prior
// caller) so a second report can build the same issue-costing inputs
// without a second definition of what a purchase or an issue is. Pure
// move -- no behaviour change.
export function buildIssueCostingPurchases(purchaseOrders: any[], purchaseOrderLines: any[]): Purchase[] {
  const completedById = new Map(
    purchaseOrders.filter(po => po.status === "COMPLETED").map(po => [po.id, po]),
  );

  const linesByOrder = new Map<string, any[]>();
  for (const line of purchaseOrderLines) {
    if (!completedById.has(line.purchase_order_id)) continue;
    const list = linesByOrder.get(line.purchase_order_id) ?? [];
    list.push(line);
    linesByOrder.set(line.purchase_order_id, list);
  }

  const purchases: Purchase[] = [];
  for (const [orderId, lines] of linesByOrder) {
    const po = completedById.get(orderId)!;
    const additions = (Number(po.shipping_fee) || 0) + (Number(po.tax_amount) || 0);
    const subtractions = (Number(po.voucher_amount) || 0) + (Number(po.discount_amount) || 0);
    const adjustedSubtotalByLineId = allocatePurchaseOrderCost(
      lines.map(l => ({ lineId: l.id, subtotal: Number(l.subtotal) || 0 })),
      additions,
      subtractions,
    );
    for (const line of lines) {
      purchases.push({
        purchased_item_id: line.purchased_item_id,
        at: po.transaction_date || po.created_at,
        base_quantity: Number(line.base_quantity) || 0,
        subtotal: adjustedSubtotalByLineId.get(line.id) ?? (Number(line.subtotal) || 0),
      });
    }
  }
  return purchases;
}

export function buildIssueCostingIssues(stockIssues: any[]): Issue[] {
  return stockIssues.map(row => ({
    purchased_item_id: row.purchased_item_id,
    at: row.issued_at,
    base_quantity: Number(row.base_quantity) || 0,
    source: row.source,
  }));
}

// section
// 3.2: equipment leaves through the asset register (depreciation), not
// through cost of goods sold -- a stock_issues row naming a piece of
// equipment must never reach computeIssueCosting, or it is charged twice
// (the full purchase price into COGS, the same asset still depreciating in
// the register). This layer is a filter, not a refusal: it protects any
// issue slip already recorded before the picker excluded equipment too
// (section 3.1) -- 0 exist today, but this must not depend on that number
// staying 0. Called by both app/admin/reports/actions.ts (getPnLDataV2)
// and app/admin/reports/issued/actions.ts (getIssuedValueReport), the only
// two callers of buildIssueCostingIssues -- one place, so both can only
// ever agree.
export function filterOutEquipmentIssues(
  stockIssues: any[],
  purchasedItems: any[],
  itemCategories: any[],
): any[] {
  const equipmentCategoryIds = new Set(
    itemCategories.filter(c => c.system_type === "EQUIPMENT").map(c => c.id),
  );
  const equipmentItemIds = new Set(
    purchasedItems.filter(p => equipmentCategoryIds.has(p.item_category_id)).map(p => p.id),
  );
  return stockIssues.filter(row => !equipmentItemIds.has(row.purchased_item_id));
}
