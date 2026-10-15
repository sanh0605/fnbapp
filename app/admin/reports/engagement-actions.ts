"use server";

import { findAllWhereInBatches } from "@/lib/db/tables";
import { coerceLineV2 } from "@/lib/sales/order-types";
import { toSaigonUtcRange, saigonBucketKeys } from "@/lib/shared/report-time";
import { requireAdmin } from "@/lib/auth/auth";
import { findCompletedOrders, selectSalesOrders, filterLinesByCategory, type PnLReportFilters } from "./report-helpers";

export interface HeatmapCell {
  dayOfWeek: string;
  hour: number;
  revenue: number;
  orderCount: number;
}

export async function getHourlyHeatmapV2(filters: PnLReportFilters = {}): Promise<HeatmapCell[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    // B4: the same filtered order selection as the rest of Doanh số
    // (date, outlet-brand, staff), and the dish-group filter below.
    const orders = await findCompletedOrders(
      toSaigonUtcRange(filters.startDate, filters.endDate),
      filters,
    );
    const filteredOrders = selectSalesOrders(orders, filters);

    // With a dish group, an order counts only if it has a line of that group,
    // worth those lines (same rule as computeSalesTotals).
    let valueOf = (o: any) => Number(o.net_total) || 0;
    let ordersToPlace = filteredOrders;
    if (filters.categoryId) {
      const lines = await findAllWhereInBatches("Order_Lines_V2", "order_id", filteredOrders.map(o => o.id));
      const revenueByOrder = new Map<string, number>();
      for (const l of filterLinesByCategory((lines as any[]).map(coerceLineV2), filters.categoryId)) {
        revenueByOrder.set(l.order_id, (revenueByOrder.get(l.order_id) || 0) + l.net_line_total);
      }
      ordersToPlace = filteredOrders.filter(o => revenueByOrder.has(o.id));
      valueOf = (o: any) => revenueByOrder.get(o.id) || 0;
    }

    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const cellsMap = new Map<string, HeatmapCell>();
    
    for (const day of days) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}_${hour}`;
        cellsMap.set(key, { dayOfWeek: day, hour, revenue: 0, orderCount: 0 });
      }
    }

    for (const o of ordersToPlace) {
      // Saigon weekday and hour, never the runtime's own zone (Vercel is UTC).
      const { dowLabel: day, hourKey } = saigonBucketKeys(o.created_at);
      const hour = Number(hourKey.slice(0, 2));
      const key = `${day}_${hour}`;
      
      const cell = cellsMap.get(key);
      if (cell) {
        cell.revenue += valueOf(o);
        cell.orderCount += 1;
      }
    }

    return Array.from(cellsMap.values());
  } catch (err: any) {
    // not in the plan's own list (found while re-deriving it). Rethrow
    // instead of a fabricated empty heatmap; app/error.tsx handles it.
    console.error("[getHourlyHeatmapV2]", err);
    throw err;
  }
}
