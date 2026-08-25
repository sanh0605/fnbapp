"use server";

import {
  findAll,
  findAllNoCache,
  findAllWhere,
  findAllWhereInBatches,
} from "@/lib/sheets_db";
import type { SheetFilter } from "@/lib/sheets_db";
import { ORDER_STATUS, coerceOrderV2, coerceLineV2 } from "@/lib/order-types";
import type { OrderV2, OrderLineV2 } from "@/lib/order-types";
import {
  breakdownRevenueByProduct,
  type ProductRevenueRow,
} from "@/lib/report-v2-allocators";
import { toSaigonUtcRange, saigonBucketKeys } from "@/lib/report-time";
import { displayMoney } from "@/lib/display-rounding";
import { computePeriodIssuedValue } from "@/lib/issue-costing";
import { buildIssueCostingPurchases, buildIssueCostingIssues } from "@/lib/issue-costing-inputs";
import { requireAdmin } from "@/lib/auth";

export interface PnLReportFilters {
  startDate?: string;
  endDate?: string;
  brandId?: string;
  staffName?: string;
  categoryId?: string;
}

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
}

function findCompletedOrders(
  dateRange: ReturnType<typeof toSaigonUtcRange>,
  reportFilters: PnLReportFilters = {},
): Promise<any[]> {
  const filters: SheetFilter = {
    eq: { status: ORDER_STATUS.COMPLETED },
  };
  if (reportFilters.brandId) {
    filters.eq!.brand_id = reportFilters.brandId;
  }
  if (reportFilters.staffName) {
    filters.eq!.created_by_name = reportFilters.staffName;
  }
  if (dateRange) {
    filters.gte = { created_at: dateRange.startUtc };
    filters.lte = { created_at: dateRange.endUtc };
  }
  return findAllWhere("Orders_V2", filters);
}

// No page renders this anymore -- app/admin/reports/pnl/page.tsx was deleted
// 2026-08-05 (Plan C Task 2b, owner decision, docs/OPEN-ITEMS.md item 31).
// The report is being redesigned as a real financial statement; this function
// is kept on purpose, not orphaned:
//   1. It is Plan C's own revenue gate -- June (22.157.000d) and July
//      (18.661.000d) are read through it before and after every remaining
//      task, including the deletions.
//   2. It is the one figure this plan still trusts, after a hand-summed
//      total proved wrong by about ten million dong on 2026-08-05.
//   3. It is what the item-31 rebuild starts from.
// Do not remove as dead code. scripts/audit-lock-bypass-history.ts and
// scripts/verify-pnl-patterns.ts also call it directly, independent of any
// page -- both fail silently until someone runs them by hand.
// scripts/audit-admin-read-guards.test.ts also asserts this function
// requires admin auth; that one fails loudly, in the suite, on removal.
export async function getPnLDataV2(filters: PnLReportFilters = {}): Promise<PnLReportResult> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const queryDateRange = toSaigonUtcRange(filters.startDate, filters.endDate);
    const orders = await findCompletedOrders(queryDateRange, filters);
    const [orderLines, recipes, modifiers, products, purchaseOrderLines, purchaseOrders, stockIssues] = await Promise.all([
      findAllWhereInBatches(
        "Order_Lines_V2",
        "order_id",
        orders.map(order => order.id),
      ),
      findAll("Recipes"),
      findAll("Modifiers"),
      findAll("Products"),
      findAllNoCache("Purchase_Order_Lines"),
      findAllNoCache("Purchase_Orders"),
      findAllNoCache("Stock_Issues"),
    ]);

    // Standalone topping → linked modifier map (CAT-007 products with migration_notes link).
    // See spec 2026-06-27-standalone-topping-report-classification-design.md.
    const standaloneToppingToModId = buildStandaloneToppingMap(products as any[]);

    const { startDate, endDate, brandId, staffName, categoryId } = filters;
    // Claude code — Phase 5.3: interpret date params as Asia/Saigon to UTC bounds.
    const dateRange = toSaigonUtcRange(startDate, endDate);

    // 1. Filter orders: latest COMPLETED versions only
    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
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
    // stock_issues do. See computePeriodIssuedValue in lib/issue-costing.ts
    // for why this is two full replays and a subtraction, not a single pass.
    const purchases = buildIssueCostingPurchases(purchaseOrders as any[], purchaseOrderLines as any[]);
    const allIssues = buildIssueCostingIssues(stockIssues as any[]);
    const totalCOGS = computePeriodIssuedValue(
      purchases,
      allIssues,
      dateRange?.startUtc ?? null,
      dateRange?.endUtc ?? null,
    );

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

    // Round at the render boundary only, owner rule 2026-07-30 (lib/display-
    // rounding.ts): cost is rounded UP, from each figure's own exact value --
    // never by summing already-rounded parts. Sorting above already happened
    // on exact grossProfit, so display rounding here does not affect order.
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
    };
  } catch (err: any) {
    console.error("[getPnLDataV2]", err);
    return {
      totalRevenue: 0,
      totalCOGS: 0,
      grossProfit: 0,
      margin: 0,
      orderCount: 0,
      productProfitAnalysis: [],
      v2OrderCount: 0,
    };
  }
}

// ============================================================
// Sales report
// ============================================================

export interface SalesReportResult {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  // Claude code — Phase 5.2: additional revenue breakdown fields.
  grossRevenue: number;
  systemPromotionDiscount: number;
  manualItemDiscount: number;
  manualOrderDiscount: number;
  totalDiscount: number;
  paymentBreakdown: Array<{ method: string; orderCount: number; revenue: number }>;
  bestSellers: Array<{
    product_id: string;
    name: string;
    totalQty: number;
    totalRevenue: number;
    sizes: Record<string, number>;
  }>;
  bestToppings: Array<{
    modifier_id: string;
    name: string;
    qty: number;
    revenue: number;
  }>;
  uniqueSizes: string[];
  totalQtyBySize: Record<string, number>;
  totalQtyAll: number;
  salesByDate: Array<{ label: string; amount: number }>;
  salesByMonth: Array<{ label: string; amount: number }>;
  salesByDayOfWeek: Array<{ label: string; amount: number }>;
  salesByHour: Array<{ label: string; amount: number }>;
  // docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 6b.
  // Sums to totalRevenue/totalOrders for the same period -- orders with no
  // outlet_id (pre-backfill history) land under outlet_id: "" rather than
  // being dropped silently.
  outletBreakdown: Array<{ outlet_id: string; name: string; orderCount: number; revenue: number }>;
  // Reconciliation indicator
  v2OrderCount: number;
}

export async function getSalesDataV2(filters: PnLReportFilters = {}): Promise<SalesReportResult> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const queryDateRange = toSaigonUtcRange(filters.startDate, filters.endDate);
    const orders = await findCompletedOrders(queryDateRange, filters);
    const [orderLines, orderPayments, modifiers, products, outlets] = await Promise.all([
      findAllWhereInBatches(
        "Order_Lines_V2",
        "order_id",
        orders.map(order => order.id),
      ),
      findAllWhereInBatches(
        "Order_Payments",
        "order_id",
        orders.map(order => order.id),
      ),
      findAll("Modifiers"),
      findAll("Products"),
      findAll("Outlets"),
    ]);

    // Standalone topping products (category_id=CAT-007) mapped to their linked
    // modifier ID via migration_notes. Used to route standalone topping sales
    // into bestToppings instead of bestSellers. See spec 2026-06-27.
    const standaloneToppingToModId = buildStandaloneToppingMap(products as any[]);

    const { startDate, endDate, brandId, staffName, categoryId } = filters;
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
      if (staffName && o.created_by_name !== staffName) return false;

      return true;
    });

    const orderIds = new Set(filteredOrders.map(o => o.id));
    const filteredLines = (orderLines as any[]).filter(l => orderIds.has(l.order_id));

    const typedOrders: OrderV2[] = filteredOrders.map(coerceOrderV2);
    let typedLines: OrderLineV2[] = filteredLines.map(coerceLineV2);

    if (categoryId) {
      typedLines = typedLines.filter(l => {
        try {
          const snap = JSON.parse(l.product_snapshot_json || "{}");
          return snap.category_id === categoryId;
        } catch {
          return false;
        }
      });
      // If filtering by category, we only want orders that contain these lines
      const validOrdersForCat = new Set(typedLines.map(l => l.order_id));
    }

    const totalRevenue = categoryId
      ? typedLines.reduce((s, l) => s + l.net_line_total, 0)
      : typedOrders.reduce((s, o) => s + o.net_total, 0);

    const totalOrders = categoryId
      ? new Set(typedLines.map(l => l.order_id)).size
      : typedOrders.length;

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Claude code — Phase 5.2: revenue breakdown + CODE-16: build Set once outside filter.
    // Compute at order level (gross/discount are order-wide fields). For category filter,
    // restrict to orders containing matching lines to keep consistent with totalOrders.
    const lineOrderIds = categoryId
      ? new Set(typedLines.map(l => l.order_id))
      : null;
    const ordersForBreakdown = lineOrderIds
      ? typedOrders.filter(o => lineOrderIds.has(o.id))
      : typedOrders;
    const grossRevenue = ordersForBreakdown.reduce((s, o) => s + o.gross_total, 0);
    const systemPromotionDiscount = ordersForBreakdown.reduce((s, o) => s + o.promo_discount_total, 0);
    const manualItemDiscount = ordersForBreakdown.reduce((s, o) => s + o.manual_item_discount_total, 0);
    const manualOrderDiscount = ordersForBreakdown.reduce((s, o) => s + o.manual_order_discount, 0);
    const totalDiscount = systemPromotionDiscount + manualItemDiscount + manualOrderDiscount;
    // Attribute revenue per payment line (order_payments), not per order, so a
    // split/mixed-payment order's revenue is divided across the methods it
    // actually used instead of being counted once under a single method.
    const breakdownOrderIds = new Set(ordersForBreakdown.map(o => o.id));
    const paymentsByOrder = new Map<string, any[]>();
    for (const p of orderPayments as any[]) {
      if (!breakdownOrderIds.has(p.order_id)) continue;
      const rows = paymentsByOrder.get(p.order_id) || [];
      rows.push(p);
      paymentsByOrder.set(p.order_id, rows);
    }
    const paymentMap = new Map<string, { orderCount: number; revenue: number }>();
    const methodsSeenPerOrder = new Set<string>();
    for (const o of ordersForBreakdown) {
      const rows = paymentsByOrder.get(o.id);
      const effectiveRows = rows && rows.length > 0
        ? rows
        : [{ method: o.payment_method || "UNKNOWN", amount: o.net_total }];
      for (const row of effectiveRows) {
        const method = row.method || "UNKNOWN";
        if (!paymentMap.has(method)) paymentMap.set(method, { orderCount: 0, revenue: 0 });
        const bucket = paymentMap.get(method)!;
        bucket.revenue += Number(row.amount) || 0;
        const dedupeKey = `${o.id}:${method}`;
        if (!methodsSeenPerOrder.has(dedupeKey)) {
          methodsSeenPerOrder.add(dedupeKey);
          bucket.orderCount += 1;
        }
      }
    }
    const paymentBreakdown = Array.from(paymentMap.entries())
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    const productRows = breakdownRevenueByProduct(typedOrders, typedLines);
    const canonicalModifiers = buildCanonicalModifierLookup(modifiers as any[]);

    const bestSellersMap = new Map<string, any>();
    const bestToppingsMap = new Map<string, any>();
    const uniqueSizesSet = new Set<string>();

    for (const r of productRows) {
      // Determine topping key: MOD-prefix (add-on) or standalone topping mapped via CAT-007 link
      let toppingModId: string | null = null;
      if (r.product_id.startsWith("MOD:")) {
        toppingModId = r.product_id.replace("MOD:", "");
      } else if (standaloneToppingToModId.has(r.product_id)) {
        toppingModId = standaloneToppingToModId.get(r.product_id) || null;
      }

      if (toppingModId) {
        const canonical = canonicalModifiers.byId.get(toppingModId)
          || canonicalModifiers.byName.get(normalizeModifierName(r.product_name))
          || { id: toppingModId, name: r.product_name };
        if (!bestToppingsMap.has(canonical.id)) {
          bestToppingsMap.set(canonical.id, { modifier_id: canonical.id, name: canonical.name, qty: 0, revenue: 0 });
        }
        const row = bestToppingsMap.get(canonical.id);
        row.qty += r.qty;
        row.revenue += r.revenue;
      } else {
        if (!bestSellersMap.has(r.product_id)) {
          bestSellersMap.set(r.product_id, {
            product_id: r.product_id,
            name: r.product_name,
            totalQty: 0,
            totalRevenue: 0,
            sizes: {},
          });
        }
        const row = bestSellersMap.get(r.product_id);
        row.totalQty += r.qty;
        row.totalRevenue += r.revenue;
        if (r.size_name) {
          row.sizes[r.size_name] = (row.sizes[r.size_name] || 0) + r.qty;
          uniqueSizesSet.add(r.size_name);
        }
      }
    }

    const bestSellers = Array.from(bestSellersMap.values()).sort((a, b) => b.totalQty - a.totalQty);
    const bestToppings = Array.from(bestToppingsMap.values()).sort((a, b) => b.qty - a.qty);
    const uniqueSizes = Array.from(uniqueSizesSet).sort();

    const totalQtyBySize: Record<string, number> = {};
    let totalQtyAll = 0;
    for (const item of bestSellers) {
      for (const [sz, q] of Object.entries(item.sizes)) {
        totalQtyBySize[sz] = (totalQtyBySize[sz] || 0) + (q as number);
        totalQtyAll += (q as number);
      }
    }

    // Time series (use typedOrders if no category, else filter orders to those containing lines)
    let timeSeriesOrders = typedOrders;
    if (categoryId) {
      const validOrderIds = new Set(typedLines.map(l => l.order_id));
      timeSeriesOrders = typedOrders.filter(o => validOrderIds.has(o.id));
    }

    const byDate = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const byDayOfWeek = new Map<string, number>();
    const byHour = new Map<string, number>();

    // docs/superpowers/plans/2026-08-26-sales-chart-timezone.md: all four
    // series bucket by the Saigon calendar date/hour, not toISOString()
    // (always UTC) or getDay()/getHours() (the runtime's local zone -- UTC
    // on Vercel, which is why this was wrong there but not on a machine
    // whose local zone already happens to be Asia/Ho_Chi_Minh).
    for (const o of timeSeriesOrders) {
      if (!o.created_at) continue;
      const rev = categoryId
        ? typedLines.filter(l => l.order_id === o.id).reduce((s, l) => s + l.net_line_total, 0)
        : o.net_total;

      const { dateKey, monthKey, dowLabel, hourKey } = saigonBucketKeys(o.created_at);
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + rev);
      byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + rev);
      byDayOfWeek.set(dowLabel, (byDayOfWeek.get(dowLabel) || 0) + rev);
      byHour.set(hourKey, (byHour.get(hourKey) || 0) + rev);
    }

    // docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 6b.
    // Same order set and per-order revenue as the time series above, so this
    // sums to totalRevenue/totalOrders for the same period. Orders with no
    // outlet_id (pre-backfill history) are kept under key "" rather than
    // dropped, so the sum-check catches a bug instead of hiding one.
    const outletNameById = new Map<string, string>(
      (outlets as any[]).map(o => [String(o.id), String(o.name)]),
    );
    const outletBuckets = new Map<string, { orderCount: number; revenue: number }>();
    for (const o of timeSeriesOrders) {
      const rev = categoryId
        ? typedLines.filter(l => l.order_id === o.id).reduce((s, l) => s + l.net_line_total, 0)
        : o.net_total;
      const outletId = o.outlet_id || "";
      if (!outletBuckets.has(outletId)) outletBuckets.set(outletId, { orderCount: 0, revenue: 0 });
      const bucket = outletBuckets.get(outletId)!;
      bucket.orderCount += 1;
      bucket.revenue += rev;
    }
    const outletBreakdown = Array.from(outletBuckets.entries())
      .map(([outlet_id, v]) => ({
        outlet_id,
        name: outlet_id ? (outletNameById.get(outlet_id) || outlet_id) : "Chưa gắn điểm bán",
        ...v,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const sortMap = (m: Map<string, number>) =>
      Array.from(m.entries()).map(([label, amount]) => ({ label, amount })).sort((a, b) => a.label.localeCompare(b.label));

    // Fix DOW sorting
    const dowOrder = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    const salesByDayOfWeek = Array.from(byDayOfWeek.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => dowOrder.indexOf(a.label) - dowOrder.indexOf(b.label));

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      grossRevenue,
      systemPromotionDiscount,
      manualItemDiscount,
      manualOrderDiscount,
      totalDiscount,
      paymentBreakdown,
      bestSellers,
      bestToppings,
      uniqueSizes,
      totalQtyBySize,
      totalQtyAll,
      salesByDate: sortMap(byDate),
      salesByMonth: sortMap(byMonth),
      salesByDayOfWeek,
      salesByHour: sortMap(byHour),
      outletBreakdown,
      v2OrderCount: typedOrders.length,
    };
  } catch (err: any) {
    console.error("[getSalesDataV2]", err);
    return {
      totalRevenue: 0, totalOrders: 0, avgOrderValue: 0,
      grossRevenue: 0, systemPromotionDiscount: 0, manualItemDiscount: 0,
      manualOrderDiscount: 0, totalDiscount: 0, paymentBreakdown: [],
      bestSellers: [], bestToppings: [],
      uniqueSizes: [], totalQtyBySize: {}, totalQtyAll: 0,
      salesByDate: [], salesByMonth: [], salesByDayOfWeek: [], salesByHour: [],
      outletBreakdown: [],
      v2OrderCount: 0,
    };
  }
}

function mergeModifierRevenueRows(
  productRows: ProductRevenueRow[],
  canonicalModifiers: ReturnType<typeof buildCanonicalModifierLookup>,
): ProductRevenueRow[] {
  const map = new Map<string, ProductRevenueRow>();

  for (const row of productRows.filter(r => r.product_id.startsWith("MOD:"))) {
    const modifierId = row.product_id.replace("MOD:", "");
    const canonical = canonicalModifiers.byId.get(modifierId)
      || canonicalModifiers.byName.get(normalizeModifierName(row.product_name))
      || { id: modifierId, name: row.product_name };
    const key = `MOD:${canonical.id}`;
    const current = map.get(key);
    if (current) {
      current.qty += row.qty;
      current.revenue += row.revenue;
    } else {
      map.set(key, {
        ...row,
        product_id: key,
        product_name: canonical.name,
        variant_id: "",
        size_name: "",
      });
    }
  }

  return Array.from(map.values());
}

type CanonicalModifier = { id: string; name: string };

/**
 * Build map: standalone topping product_id -> linked modifier_id.
 *
 * Standalone toppings are Products in category CAT-007 created by
 * scripts/setup-topping-standalone.ts. Each carries migration_notes
 * `topping-standalone::mod_id=MOD-XXX` linking back to its modifier.
 * Used to route standalone topping sales into topping sections of reports.
 *
 * Spec: docs/superpowers/specs/2026-06-27-standalone-topping-report-classification-design.md
 */
function buildStandaloneToppingMap(products: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of products) {
    if (String(p.category_id) !== "CAT-007") continue;
    const match = String(p.migration_notes || "").match(/topping-standalone::mod_id=(MOD-\d+)/);
    // A CAT-007 product with no migration_notes link still belongs in
    // bestToppings, not bestSellers -- fall back to bucketing under its own
    // product ID rather than dropping it out of the map entirely. Matches
    // docs/superpowers/specs/2026-06-27-standalone-topping-report-classification-design.md.
    map.set(String(p.id), match ? match[1] : String(p.id));
  }
  return map;
}

function buildCanonicalModifierLookup(modifiers: any[]): {
  byId: Map<string, CanonicalModifier>;
  byName: Map<string, CanonicalModifier>;
} {
  const byNameGroup = new Map<string, any[]>();
  for (const modifier of modifiers) {
    const id = String(modifier.id || "");
    const name = String(modifier.name || "").trim();
    if (!id || !name) continue;
    const key = normalizeModifierName(name);
    if (!key) continue;
    const group = byNameGroup.get(key) || [];
    group.push(modifier);
    byNameGroup.set(key, group);
  }

  const byId = new Map<string, CanonicalModifier>();
  const byName = new Map<string, CanonicalModifier>();

  for (const [nameKey, group] of byNameGroup.entries()) {
    const canonicalRow = [...group].sort(compareModifierCanonicalPriority)[0];
    const canonical = {
      id: String(canonicalRow.id),
      name: String(canonicalRow.name || canonicalRow.id),
    };
    byName.set(nameKey, canonical);
    for (const row of group) {
      byId.set(String(row.id), canonical);
    }
  }

  return { byId, byName };
}

function compareModifierCanonicalPriority(a: any, b: any): number {
  const aActive = a.status === "DELETED" ? 0 : 1;
  const bActive = b.status === "DELETED" ? 0 : 1;
  if (aActive !== bActive) return bActive - aActive;

  const aTime = new Date(a.created_at || 0).getTime();
  const bTime = new Date(b.created_at || 0).getTime();
  if (aTime !== bTime) return bTime - aTime;

  return modifierIdNumber(b.id) - modifierIdNumber(a.id);
}

function modifierIdNumber(id: string): number {
  const match = String(id || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function normalizeModifierName(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

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
      const d = new Date(o.created_at);
      const day = days[d.getDay()];
      const hour = d.getHours();
      const key = `${day}_${hour}`;
      
      const cell = cellsMap.get(key);
      if (cell) {
        cell.revenue += Number(o.net_total) || 0;
        cell.orderCount += 1;
      }
    }

    return Array.from(cellsMap.values());
  } catch (err: any) {
    console.error("[getHourlyHeatmapV2]", err);
    return [];
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
    console.error("[getPromotionPerformanceV2]", err);
    return [];
  }
}
