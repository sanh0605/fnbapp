// The three cards of Doanh số (BR-UI-007): revenue, order count, average order.
// With a category, only that category's lines count and an order is counted once.

export interface SalesTotals {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
}

export function computeSalesTotals(
  orders: Array<{ id: string; net_total: number }>,
  categoryLines: Array<{ order_id: string; net_line_total: number }> | null,
): SalesTotals {
  const totalRevenue = categoryLines
    ? categoryLines.reduce((s, l) => s + l.net_line_total, 0)
    : orders.reduce((s, o) => s + o.net_total, 0);
  const totalOrders = categoryLines ? new Set(categoryLines.map(l => l.order_id)).size : orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  return { totalRevenue, totalOrders, avgOrderValue };
}
