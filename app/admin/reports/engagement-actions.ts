"use server";

import { findAll } from "@/lib/db/tables";
import { ORDER_STATUS } from "@/lib/sales/order-types";
import { toSaigonUtcRange, saigonBucketKeys } from "@/lib/shared/report-time";
import { requireAdmin } from "@/lib/auth/auth";
import { findCompletedOrders, type PnLReportFilters } from "./report-helpers";

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
    const orders = await findCompletedOrders(
      toSaigonUtcRange(filters.startDate, filters.endDate),
    );
    const { startDate, endDate, brandId } = filters;
    // Claude code — Phase 5.3: Asia/Saigon date bounds.
    const dateRange = toSaigonUtcRange(startDate, endDate);

    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
      if (!o.created_at) return false;

      if (dateRange) {
        const d = new Date(o.created_at);
        if (d < dateRange.startUtc || d > dateRange.endUtc) return false;
      }
      if (brandId && o.brand_id !== brandId) return false;

      return true;
    });

    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const cellsMap = new Map<string, HeatmapCell>();
    
    for (const day of days) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}_${hour}`;
        cellsMap.set(key, { dayOfWeek: day, hour, revenue: 0, orderCount: 0 });
      }
    }

    for (const o of filteredOrders) {
      // Saigon weekday and hour, never the runtime's own zone (Vercel is UTC).
      const { dowLabel: day, hourKey } = saigonBucketKeys(o.created_at);
      const hour = Number(hourKey.slice(0, 2));
      const key = `${day}_${hour}`;
      
      const cell = cellsMap.get(key);
      if (cell) {
        cell.revenue += Number(o.net_total) || 0;
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

export interface PromotionPerformanceRow {
  promotion_id: string;
  name: string;
  code: string;
  type: string;
  appliedCount: number;
  totalDiscount: number;
  totalRevenue: number;
}

export async function getPromotionPerformanceV2(filters: PnLReportFilters = {}): Promise<PromotionPerformanceRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const dateRange = toSaigonUtcRange(filters.startDate, filters.endDate);
    const [orders, promotions] = await Promise.all([
      findCompletedOrders(dateRange, filters),
      findAll("Promotions"),
    ]);

    const { startDate, endDate, brandId } = filters;
    // Claude code — Phase 5.3: Asia/Saigon date bounds.
    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
      if (!o.created_at) return false;

      if (dateRange) {
        const d = new Date(o.created_at);
        if (d < dateRange.startUtc || d > dateRange.endUtc) return false;
      }
      if (brandId && o.brand_id !== brandId) return false;

      return true;
    });

    const perfMap = new Map<string, PromotionPerformanceRow>();
    
    for (const p of promotions as any[]) {
      perfMap.set(p.id, {
        promotion_id: p.id,
        name: p.name || "(Không tên)",
        code: p.code || "(Tự động)",
        type: p.type || "PRODUCT_DISCOUNT",
        appliedCount: 0,
        totalDiscount: 0,
        totalRevenue: 0,
      });
    }

    for (const o of filteredOrders) {
      if (!o.applied_promotion_id) continue;
      const promoId = o.applied_promotion_id;
      
      let row = perfMap.get(promoId);
      if (!row) {
        row = {
          promotion_id: promoId,
          name: `Khuyến mãi #${promoId}`,
          code: "",
          type: "",
          appliedCount: 0,
          totalDiscount: 0,
          totalRevenue: 0,
        };
        perfMap.set(promoId, row);
      }
      
      row.appliedCount += 1;
      row.totalDiscount += Number(o.promo_discount_total) || 0;
      row.totalRevenue += Number(o.net_total) || 0;
    }

    return Array.from(perfMap.values()).filter(r => r.appliedCount > 0);
  } catch (err: any) {
    // not in the plan's own list (found while re-deriving it). Rethrow
    // instead of a fabricated empty result; app/error.tsx handles it.
    console.error("[getPromotionPerformanceV2]", err);
    throw err;
  }
}
