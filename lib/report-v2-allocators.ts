import { allocateLineRevenue } from "@/lib/order-math";
import type { OrderV2, OrderLineV2, LineForAllocation } from "@/lib/order-types";

export interface ProductRevenueRow {
  product_id: string;
  product_name: string;
  variant_id: string;
  size_name: string;
  qty: number;
  revenue: number;
}

export function breakdownRevenueByProduct(
  orders: OrderV2[],
  lines: OrderLineV2[],
): ProductRevenueRow[] {
  const validOrderIds = new Set(orders.map(o => o.id));
  const map = new Map<string, ProductRevenueRow>();

  for (const line of lines) {
    if (!validOrderIds.has(line.order_id)) continue;

    const productSnap = JSON.parse(line.product_snapshot_json || "{}");
    const variantSnap = JSON.parse(line.variant_snapshot_json || "{}");
    const modifiers = JSON.parse(line.modifiers_snapshot_json || "[]");

    const lineForAlloc: LineForAllocation = {
      unit_price: line.unit_price,
      qty: line.qty,
      modifiers,
      gross_line_total: line.gross_line_total,
      promo_discount: line.promo_discount,
      manual_item_discount: line.manual_item_discount,
      order_discount_allocation: line.order_discount_allocation,
    };

    const alloc = allocateLineRevenue(lineForAlloc);

    // Variant row
    const variantKey = `${line.product_id}__${line.variant_id}`;
    if (!map.has(variantKey)) {
      map.set(variantKey, {
        product_id: line.product_id,
        product_name: productSnap.name || line.product_id,
        variant_id: line.variant_id,
        size_name: variantSnap.size_name || "",
        qty: 0,
        revenue: 0,
      });
    }
    const variantRow = map.get(variantKey)!;
    variantRow.qty += line.qty;
    variantRow.revenue += alloc.variantRevenue;

    // Modifier rows (each modifier is its own pseudo-product for revenue attribution)
    for (const mod of modifiers) {
      const modKey = `MOD:${mod.id}`;
      if (!map.has(modKey)) {
        map.set(modKey, {
          product_id: modKey,
          product_name: mod.name || mod.id,
          variant_id: "",
          size_name: "",
          qty: 0,
          revenue: 0,
        });
      }
      const modRow = map.get(modKey)!;
      modRow.qty += line.qty * Number(mod.qty || 1);
      modRow.revenue += alloc.modifierRevenue[mod.id] || 0;
    }
  }

  return Array.from(map.values()).filter(r => r.qty > 0 || r.revenue > 0);
}
