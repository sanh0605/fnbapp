"use server";

import { getSalesDataV2 } from "../actions";
import { getRealtimeStock } from "@/app/admin/inventory/actions";
import { requireAdmin } from "@/lib/auth";
import { getDigestDateOffsets, comparePeriods, type PeriodComparison } from "@/lib/daily-digest";
import { toSaigonIsoString } from "@/lib/datetime";

export interface DailyDigestPeriod {
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
}

export interface DailyDigestResult {
  date: string;
  today: DailyDigestPeriod;
  vsYesterday: PeriodComparison;
  vsSameWeekdayLastWeek: PeriodComparison;
  topItems: Array<{ product_id: string; name: string; totalQty: number; totalRevenue: number }>;
  paymentBreakdown: Array<{ method: string; orderCount: number; revenue: number }>;
  negativeStockItems: Array<{ id: string; name: string; current_stock: number; unitName: string }>;
}

async function getPeriodSummary(dateStr: string): Promise<DailyDigestPeriod> {
  const data = await getSalesDataV2({ startDate: dateStr, endDate: dateStr });
  return {
    revenue: data.totalRevenue,
    orderCount: data.totalOrders,
    avgOrderValue: data.avgOrderValue,
  };
}

export async function getDailyDigest(dateStr?: string): Promise<DailyDigestResult> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  // 2026-08-27 fix (OPEN-ITEMS 64): new Date().toISOString() is UTC --
  // sliced directly, this opened yesterday's report between 00:00 and
  // 07:00 Saigon, and getDigestDateOffsets(date) shifted yesterday and
  // last-week along with it, so the comparison still looked internally
  // consistent while being a day off.
  const date = dateStr || toSaigonIsoString(new Date()).slice(0, 10);
  const { today, yesterday, sameWeekdayLastWeek } = getDigestDateOffsets(date);

  const [todayData, todaySummary, yesterdaySummary, lastWeekSummary, realtimeStock] =
    await Promise.all([
      getSalesDataV2({ startDate: today, endDate: today }),
      getPeriodSummary(today),
      getPeriodSummary(yesterday),
      getPeriodSummary(sameWeekdayLastWeek),
      getRealtimeStock(),
    ]);

  const topItems = [...todayData.bestSellers]
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 5)
    .map(item => ({
      product_id: item.product_id,
      name: item.name,
      totalQty: item.totalQty,
      totalRevenue: item.totalRevenue,
    }));

  return {
    date: today,
    today: todaySummary,
    vsYesterday: comparePeriods(todaySummary, yesterdaySummary),
    vsSameWeekdayLastWeek: comparePeriods(todaySummary, lastWeekSummary),
    topItems,
    paymentBreakdown: todayData.paymentBreakdown,
    negativeStockItems: realtimeStock
      .filter(item => item.current_stock < 0)
      .map(item => ({ id: item.id, name: item.name, current_stock: item.current_stock, unitName: item.unitName })),
  };
}
