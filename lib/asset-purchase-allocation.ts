import { allocatePurchaseOrderCost } from "@/lib/purchase-order-cost-allocation";
import { findBandForUnitPrice, type Band } from "@/lib/asset-depreciation";

// Batch 3 (section 3.2): "unit_cost is the allocated cost per unit ... Take it from
// what the purchase flow already computes; do not re-implement the
// allocation here." BR-COGS-006's own authoritative implementation is
// allocatePurchaseOrderCost (docs/02-rules/business-rules/cogs.md: "Implemented
// 2026-08-09 (Plan D D11, lib/purchase-order-cost-allocation.ts)") -- the
// same primitive lib/issue-costing-inputs.ts uses to feed the COGS report.
// Reused directly here, not re-derived.
//
// Deliberately NOT lib/purchase-ledger-rebuild.ts's buildPurchaseReceipt,
// even though that function already computes a per-line unit_cost too:
// its internal calculateLineLandedCost is a plain float proportion with no
// residue correction, a different (and undocumented-as-BR-COGS-006)
// allocation from the one the COGS report and this business rule actually
// specify. Found while tracing where BR-COGS-006 lives; not fixed here --
// out of this plan's scope, and stock_ledger's unit_cost is not read by
// any report today (CLAUDE.md section 7). Flagged in the handoff report.

export type EquipmentPurchaseLine = {
  lineId: string;
  purchasedItemId: string;
  itemName: string;
  subtotal: number;
  // 2026-08-26:
  // renamed from `quantity` to force every caller to decide explicitly.
  // Must be the BASE quantity (e.g. 10 bottles), not the purchase-unit
  // quantity (e.g. 1 box) -- a purchase of "1 Combo 10" at 108.000d must
  // become 10 assets at 10.800d each, not 1 asset at 108.000d.
  baseQuantity: number;
};

export type NewAssetPlan = {
  purchased_item_id: string;
  purchase_order_line_id: string;
  name_snapshot: string;
  unit_cost: number;
  // 2026-08-23 fix (section 3): the allocated line total, unrounded by
  // division. unit_cost stays for the band lookup and for display, but the
  // depreciation schedule's basis is this figure, not quantity * unit_cost
  // -- multiplying a rounded per-unit price back up does not reproduce
  // what was paid.
  total_cost: number;
  quantity: number;
  term_months: number;
};

// allLines must be every line of the order (not just the equipment ones) --
// allocatePurchaseOrderCost divides the order's shipping/tax/voucher/
// discount adjustment in proportion to EVERY line's subtotal, the same
// shape buildIssueCostingPurchases already uses. Passing only the
// equipment lines would silently change what each one's share is.
export function planAssetsFromCompletedOrder(params: {
  allLines: Array<{ lineId: string; subtotal: number }>;
  equipmentLines: EquipmentPurchaseLine[];
  additions: number;
  subtractions: number;
  bands: Band[];
}): NewAssetPlan[] {
  const { allLines, equipmentLines, additions, subtractions, bands } = params;
  const allocatedByLineId = allocatePurchaseOrderCost(allLines, additions, subtractions);

  const plans: NewAssetPlan[] = [];
  for (const line of equipmentLines) {
    if (line.baseQuantity <= 0) {
      throw new Error(`${line.itemName}: hàng dụng cụ không có số lượng hợp lệ`);
    }
    const allocatedTotal = allocatedByLineId.get(line.lineId) ?? line.subtotal;
    const unitCost = Math.round(allocatedTotal / line.baseQuantity);
    const band = findBandForUnitPrice(bands, unitCost);
    if (!band) {
      throw new Error(`${line.itemName}: không tìm thấy khung khấu hao cho đơn giá ${unitCost}đ`);
    }
    plans.push({
      purchased_item_id: line.purchasedItemId,
      purchase_order_line_id: line.lineId,
      name_snapshot: line.itemName,
      unit_cost: unitCost,
      total_cost: allocatedTotal,
      quantity: line.baseQuantity,
      term_months: band.term_months,
    });
  }
  return plans;
}
