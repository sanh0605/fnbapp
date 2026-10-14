// Shared private helpers for the order server actions (list, detail, void,
// edit). Not a "use server" module: plain functions, no endpoints.

export function parseObject(value: any): any {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

// Coerce raw sheet row (strings) into typed OrderV2/OrderLineV2 with numeric fields
export function normalizeOrderV2(row: any): any {
  return {
    ...row,
    version: Number(row.version) || 1,
    gross_total: Number(row.gross_total) || 0,
    promo_discount_total: Number(row.promo_discount_total) || 0,
    manual_item_discount_total: Number(row.manual_item_discount_total) || 0,
    manual_order_discount: Number(row.manual_order_discount) || 0,
    net_total: Number(row.net_total) || 0,
  };
}

export function normalizeLineV2(row: any): any {
  return {
    ...row,
    line_no: Number(row.line_no) || 0,
    qty: Number(row.qty) || 0,
    unit_price: Number(row.unit_price) || 0,
    gross_line_total: Number(row.gross_line_total) || 0,
    promo_discount: Number(row.promo_discount) || 0,
    manual_item_discount: Number(row.manual_item_discount) || 0,
    order_discount_allocation: Number(row.order_discount_allocation) || 0,
    net_line_total: Number(row.net_line_total) || 0,
    cost_at_sale: Number(row.cost_at_sale) || 0,
  };
}
