"use server";

import { findAllWhere } from "@/lib/sheets_db";
import { getSalesDataV2 } from "../actions";
import { getReorderSuggestions, getRealtimeStock } from "@/app/admin/inventory/actions";
import { requireAdmin } from "@/lib/auth";
import { getDigestDateOffsets, comparePeriods, type PeriodComparison } from "@/lib/daily-digest";
import type { ReorderSuggestion } from "@/lib/reorder-suggestion";

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
  lowStockItems: ReorderSuggestion[];
  negativeStockItems: Array<{ id: string; name: string; current_stock: number; unitName: string }>;
  pendingBackdatedEventsCount: number;
}

async function getPeriodSummary(dateStr: string): Promise<DailyDigestPeriod> {
  const data = await getSalesDataV2({ startDate: dateStr, endDate: dateStr });
  return {
    revenue: data.totalRevenue,
    orderCount: data.totalOrders,
    avgOrderValue: data.avgOrderValue,
  };
}

async function getPendingBackdatedEventsCount(): Promise<number> {
  const [ledgerEvents, recipeEvents] = await Promise.all([
    findAllWhere("backdated_ledger_events", { eq: { status: "PENDING" } }),
    findAllWhere("backdated_recipe_events", { eq: { status: "PENDING" } }),
  ]);
  return ledgerEvents.length + recipeEvents.length;
}

export async function getDailyDigest(dateStr?: string): Promise<DailyDigestResult> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const date = dateStr || new Date().toISOString().slice(0, 10);
  const { today, yesterday, sameWeekdayLastWeek } = getDigestDateOffsets(date);

  const [todayData, todaySummary, yesterdaySummary, lastWeekSummary, reorderSuggestions, realtimeStock, pendingBackdatedEventsCount] =
    await Promise.all([
      getSalesDataV2({ startDate: today, endDate: today }),
      getPeriodSummary(today),
      getPeriodSummary(yesterday),
      getPeriodSummary(sameWeekdayLastWeek),
      getReorderSuggestions(),
      getRealtimeStock(),
      getPendingBackdatedEventsCount(),
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
    lowStockItems: reorderSuggestions.filter(s => s.isLowStock),
    negativeStockItems: realtimeStock
      .filter(item => item.current_stock < 0)
      .map(item => ({ id: item.id, name: item.name, current_stock: item.current_stock, unitName: item.unitName })),
    pendingBackdatedEventsCount,
  };
}
