"use server";

import { findAll, findAllNoCache, findAllWhereInBatches } from "@/lib/db/tables";
import { ORDER_STATUS, coerceOrderV2, coerceLineV2 } from "@/lib/sales/order-types";
import type { OrderV2, OrderLineV2 } from "@/lib/sales/order-types";
import { breakdownRevenueByProduct } from "@/lib/reports/report-v2-allocators";
import { toSaigonUtcRange } from "@/lib/shared/report-time";
import { displayMoney } from "@/lib/reports/display-rounding";
import { computePeriodIssuedValues } from "@/lib/costing/issue-costing";
import { buildIssueCostingPurchases, buildClassifiedIssues, selectCostedIssues } from "@/lib/costing/issue-costing-inputs";
import { buildStandaloneToppingProductLinks } from "@/lib/products/standalone-topping-links";
import { requireAdmin } from "@/lib/auth/auth";
import {
  findCompletedOrders,
  mergeModifierRevenueRows,
  buildCanonicalModifierLookup,
  type PnLReportFilters,
} from "./report-helpers";

export interface PnLReportResult {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  margin: number;
  orderCount: number;
  // Plan C: per-product cost and margin retired by design (spec section 9)
  // -- issue-based costing cannot attribute a purchased item's cost to one
  // drink, so this row carries revenue and quantity only.
  productProfitAnalysis: Array<{
    product_id: string;
    product_name: string;
    variant_id: string;
    size_name: string;
    qty: number;
    revenue: number;
  }>;
  // Reconciliation indicator
  v2OrderCount: number;
  v1OrderCount?: number; // optional, set by reconciliation script
  // BR-COGS-007,
  // BR-COGS-007. totalCOGS's own meaning is unchanged -- it still is Giá
  // vốn + Hao hụt combined (scripts/verify-cogs.ts Gate 2 compares it
  // against a combined recomputation). shrinkageValue is the new, additive
  // Hao hụt line, rounded from its own exact value, never derived by
  // subtracting from totalCOGS.
  shrinkageValue: number;
  // Task 4, BR-COGS-007's own precondition guard: distinct MANUAL issue
  // slips in the period, shown beside shrinkageValue so a reader can judge
  // whether the shrinkage figure means anything (a period with few or no
  // MANUAL slips has no baseline for "variance").
  manualIssueSlipCount: number;
}

// The independent reference computation scripts/verify-pnl-monthly.ts checks Lãi lỗ against
// (0 mismatches). No page renders it; scripts/verify-cogs.ts also reads it (Gate 2).
export async function getPnLDataV2(filters: PnLReportFilters = {}): Promise<PnLReportResult> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const queryDateRange = toSaigonUtcRange(filters.startDate, filters.endDate);
    const orders = await findCompletedOrders(queryDateRange, filters);
    const [orderLines, modifiers, products, purchaseOrderLines, purchaseOrders, stockIssues, purchasedItems, itemCategories, stocktakeSessions] = await Promise.all([
      findAllWhereInBatches(
        "Order_Lines_V2",
        "order_id",
        orders.map(order => order.id),
      ),
      findAll("Modifiers"),
      findAll("Products"),
      findAllNoCache("Purchase_Order_Lines"),
      findAllNoCache("Purchase_Orders"),
      findAllNoCache("Stock_Issues"),
      findAll("Purchased_Items"),
      findAll("Item_Categories"),
      // BR-COGS-007: which stocktake sessions count as shrinkage.
      // Real table name, not a Sheets alias -- matches every other reader
      // of this table (app/admin/inventory/stocktake/actions.ts, verify-cogs.ts).
      findAll("stocktake_sessions"),
    ]);

    // Standalone topping -> linked modifier map, via the real join
    // (modifiers.product_id, migration 0097), not the dead
    // products.migration_notes regex the old buildStandaloneToppingMap read.
    // BR-CATALOG-003,
    // BR-CATALOG-003 ("the link is the join, not the name").
    const standaloneToppingToModId = buildStandaloneToppingProductLinks(modifiers as any[]);

    const { startDate, endDate, brandId, staffName, categoryId } = filters;
    // Claude code — Phase 5.3: interpret date params as Asia/Saigon to UTC bounds.
    const dateRange = toSaigonUtcRange(startDate, endDate);

    // 1. Filter orders: latest COMPLETED versions only
    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (!o.created_at) return false;

      if (dateRange) {
        const d = new Date(o.created_at);
        if (d < dateRange.startUtc || d > dateRange.endUtc) return false;
      }
      if (brandId && o.brand_id !== brandId) return false;
      if (staffName && o.created_by_name !== staffName) return false;

      return true;
    });

    const orderIds = new Set(filteredOrders.map(o => o.id));
    const filteredLines = (orderLines as any[]).filter(l => orderIds.has(l.order_id));

    // Coerce types
    const typedOrders: OrderV2[] = filteredOrders.map(coerceOrderV2);
    let typedLines: OrderLineV2[] = filteredLines.map(coerceLineV2);

    // Apply category filter on lines if present
    if (categoryId) {
      typedLines = typedLines.filter(l => {
        try {
          const snap = JSON.parse(l.product_snapshot_json || "{}");
          return snap.category_id === categoryId;
        } catch {
          return false;
        }
      });
    }

    const reportOrderCount = categoryId
      ? new Set(typedLines.map(line => line.order_id)).size
      : typedOrders.length;

    // 2. Total revenue. With category filter, only revenue from matching lines belongs in the report.
    const totalRevenue = categoryId
      ? typedLines.reduce((s, line) => s + line.net_line_total, 0)
      : typedOrders.reduce((s, o) => s + o.net_total, 0);

    // 3. Total COGS = sum of issued_value over the period's issues (Plan C
    // Task 2). Sales no longer determine cost -- purchases and recorded
    // stock_issues do. See computePeriodIssuedValue in lib/costing/issue-costing.ts
    // for why this is two full replays and a subtraction, not a single pass.
    const purchases = buildIssueCostingPurchases(purchaseOrders as any[], purchaseOrderLines as any[]);
    // section 3.2, widened by BR-COGS-007 (2026-09-11): an issue slip line
    // must never enter COGS if it names equipment (already depreciates
    // through the asset register) or an item bought for immediate use
    // (already counted on the Nguyên liệu mua dùng ngay line) -- either way
    // counting it here too would charge its money twice.
    const costedIssues = selectCostedIssues(stockIssues as any[], purchasedItems as any[], itemCategories as any[]);
    // BR-COGS-007. One combined chronological replay, tagged --
    // never a subset replay of just the STOCKTAKE rows, which would shift
    // the weighted-average pool for every later event and answer a
    // different question (see lib/costing/issue-costing.ts). totalCOGS
    // stays the combined figure; issuedValueSplit is the additive split of
    // the same two replays.
    const classifiedIssues = buildClassifiedIssues(costedIssues, stocktakeSessions as any[]);
    const issuedValueSplit = computePeriodIssuedValues(
      purchases,
      classifiedIssues,
      dateRange?.startUtc ?? null,
      dateRange?.endUtc ?? null,
    );
    const totalCOGS = issuedValueSplit.total;

    // Task 4, BR-COGS-007's own precondition guard: distinct MANUAL issue
    // slips within the period -- a STOCKTAKE session is not a slip of
    // manual recording activity, so it is not counted here. Grouped by
    // issue_slip_id the same way computeIssuedEventFigures groups MANUAL
    // rows (lib/reports/issued-value-report.ts), falling back to the row's
    // own id if a slip somehow carries none.
    const manualIssuesInPeriod = costedIssues.filter((row: any) => {
      if (row.source !== "MANUAL") return false;
      const at = new Date(row.issued_at);
      if (dateRange?.startUtc && at < dateRange.startUtc) return false;
      if (dateRange?.endUtc && at > dateRange.endUtc) return false;
      return true;
    });
    const manualIssueSlipCount = new Set(
      manualIssuesInPeriod.map((row: any) => row.issue_slip_id ?? row.id),
    ).size;

    // 4. Per-product revenue breakdown
    const productRows = breakdownRevenueByProduct(typedOrders, typedLines);

    // 5. Product profit analysis: revenue and quantity only. Per-product
    // cost and margin retired by design (spec section 9) -- issue-based
    // costing knows what left stock, not which drink used it, so there is
    // no way to attribute a purchased item's cost to one product.
    const productProfitAnalysis = productRows
      .filter(r => !r.product_id.startsWith("MOD:") && !standaloneToppingToModId.has(r.product_id))
      .map(r => ({
        product_id: r.product_id,
        product_name: r.product_name,
        variant_id: r.variant_id,
        size_name: r.size_name,
        qty: r.qty,
        revenue: r.revenue,
      }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);

    // Add topping rows (modifiers as pseudo-products + standalone toppings merged via modId)
    const canonicalModifiers = buildCanonicalModifierLookup(modifiers as any[]);
    const toppingRevenueRows = mergeModifierRevenueRows(productRows, canonicalModifiers);

    // Aggregate standalone topping revenue by linked modifier ID (cost retired, see above)
    const standaloneByModId = new Map<string, { qty: number; revenue: number; name: string }>();
    for (const r of productRows) {
      const modId = standaloneToppingToModId.get(r.product_id);
      if (!modId) continue;
      const existing = standaloneByModId.get(modId);
      if (existing) {
        existing.qty += r.qty;
        existing.revenue += r.revenue;
      } else {
        standaloneByModId.set(modId, { qty: r.qty, revenue: r.revenue, name: r.product_name });
      }
    }

    // Build a combined toppingRows map keyed by `MOD:<id>` so standalone merges with add-on
    const toppingRowMap = new Map<string, {
      product_id: string;
      product_name: string;
      qty: number;
      revenue: number;
    }>();
    for (const r of toppingRevenueRows) {
      toppingRowMap.set(r.product_id, {
        product_id: r.product_id,
        product_name: r.product_name,
        qty: r.qty,
        revenue: r.revenue,
      });
    }
    for (const [modId, agg] of standaloneByModId) {
      const key = `MOD:${modId}`;
      const existing = toppingRowMap.get(key);
      if (existing) {
        existing.qty += agg.qty;
        existing.revenue += agg.revenue;
      } else {
        toppingRowMap.set(key, {
          product_id: key,
          product_name: agg.name,
          qty: agg.qty,
          revenue: agg.revenue,
        });
      }
    }

    const toppingRows = Array.from(toppingRowMap.values()).map(r => ({
      product_id: r.product_id,
      product_name: r.product_name,
      variant_id: "",
      size_name: "",
      qty: r.qty,
      revenue: r.revenue,
    }));

    // Round at the render boundary only, BR-DATA-005
    // (lib/reports/display-rounding.ts): rounded to the nearest đồng, from
    // each figure's own exact value -- never by summing already-rounded
    // parts. Sorting above already happened on exact grossProfit, so
    // display rounding here does not affect order.
    const displayedTotalCOGS = displayMoney(totalCOGS);
    const displayedGrossProfit = totalRevenue - displayedTotalCOGS;
    const displayedMargin = totalRevenue > 0 ? (displayedGrossProfit / totalRevenue) * 100 : 0;

    const displayedProductProfitAnalysis = [...productProfitAnalysis, ...toppingRows];

    return {
      totalRevenue,
      totalCOGS: displayedTotalCOGS,
      grossProfit: displayedGrossProfit,
      margin: displayedMargin,
      orderCount: reportOrderCount,
      productProfitAnalysis: displayedProductProfitAnalysis,
      v2OrderCount: typedOrders.length,
      shrinkageValue: displayMoney(issuedValueSplit.shrinkage),
      manualIssueSlipCount,
    };
  } catch (err: any) {
    // not in the plan's own list (found while re-deriving it), and arguably
    // worse than an empty list -- an all-zero P&L reads as "no sales this
    // period", not "we don't know". Rethrow instead; app/error.tsx handles it.
    console.error("[getPnLDataV2]", err);
    throw err;
  }
}
