"use server";

import { effectivePaymentRows } from "@/lib/sales/payment-method";
import { findAll, findAllWhereInBatches } from "@/lib/db/tables";
import { coerceOrderV2, coerceLineV2 } from "@/lib/sales/order-types";
import type { OrderV2, OrderLineV2 } from "@/lib/sales/order-types";
import { breakdownRevenueByProduct } from "@/lib/reports/report-v2-allocators";
import { toSaigonUtcRange, saigonBucketKeys } from "@/lib/shared/report-time";
import { computeSalesTotals, type SalesTotals } from "@/lib/reports/sales-totals";
import { buildStandaloneToppingProductLinks } from "@/lib/products/standalone-topping-links";
import { requireAdmin } from "@/lib/auth/auth";
import {
  findCompletedOrders,
  selectSalesOrders,
  filterLinesByCategory,
  sumNetByOrder,
  buildCanonicalModifierLookup,
  normalizeModifierName,
  type PnLReportFilters,
} from "./report-helpers";

export interface BestSeller {
  product_id: string;
  name: string;
  totalQty: number;
  totalRevenue: number;
  sizes: Record<string, number>;
}

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
  // One row per method; paymentCount counts payments, so a split order sits in two rows.
  // paymentOrderCount is the number of orders those payments belong to.
  paymentBreakdown: Array<{ method: string; paymentCount: number; revenue: number }>;
  paymentOrderCount: number;
  // Dishes (not toppings) split by the group written on the sold line: drink groups vs the rest.
  bestDrinks: BestSeller[];
  bestFoods: BestSeller[];
  // Revenue by the line's own group name; toppings are one "Topping" row, a missing group is "Khác".
  categorySales: Array<{ label: string; amount: number }>;
  bestToppings: Array<{
    modifier_id: string;
    name: string;
    qty: number;
    revenue: number;
  }>;
  uniqueSizes: string[];
  salesByDate: Array<{ label: string; amount: number }>;
  salesByMonth: Array<{ label: string; amount: number }>;
  salesByDayOfWeek: Array<{ label: string; amount: number }>;
  salesByHour: Array<{ label: string; amount: number }>;
  // section 6b.
  // Sums to totalRevenue/totalOrders for the same period -- orders with no
  // outlet_id (pre-backfill history) land under outlet_id: "" rather than
  // being dropped silently.
  outletBreakdown: Array<{ outlet_id: string; name: string; orderCount: number; revenue: number }>;
  // Reconciliation indicator
  v2OrderCount: number;
}

/** Only the three Doanh số cards; loads lines only when a category is chosen. */
export async function getSalesTotalsV2(filters: PnLReportFilters = {}): Promise<SalesTotals> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const orders = await findCompletedOrders(toSaigonUtcRange(filters.startDate, filters.endDate), filters);
  const typedOrders: OrderV2[] = selectSalesOrders(orders, filters).map(coerceOrderV2);
  if (!filters.categoryId) return computeSalesTotals(typedOrders, null);

  const lines = await findAllWhereInBatches("Order_Lines_V2", "order_id", typedOrders.map(o => o.id));
  const typedLines = filterLinesByCategory((lines as any[]).map(coerceLineV2), filters.categoryId);
  return computeSalesTotals(typedOrders, typedLines);
}

export async function getSalesDataV2(filters: PnLReportFilters = {}): Promise<SalesReportResult> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const queryDateRange = toSaigonUtcRange(filters.startDate, filters.endDate);
    const orders = await findCompletedOrders(queryDateRange, filters);
    const [orderLines, orderPayments, modifiers, outlets, categories, productTypes] = await Promise.all([
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
      findAll("Outlets"),
      findAll("Product_Categories"),
      findAll("Product_Types"),
    ]);

    // Standalone topping -> linked modifier map, via modifiers.product_id
    // (migration 0097). See the sibling call in getPnLDataV2 above.
    const standaloneToppingToModId = buildStandaloneToppingProductLinks(modifiers as any[]);

    const { categoryId } = filters;
    const filteredOrders = selectSalesOrders(orders, filters);

    const orderIds = new Set(filteredOrders.map(o => o.id));
    const filteredLines = (orderLines as any[]).filter(l => orderIds.has(l.order_id));

    const typedOrders: OrderV2[] = filteredOrders.map(coerceOrderV2);
    let typedLines: OrderLineV2[] = filteredLines.map(coerceLineV2);

    if (categoryId) typedLines = filterLinesByCategory(typedLines, categoryId);

    const { totalRevenue, totalOrders, avgOrderValue } = computeSalesTotals(
      typedOrders,
      categoryId ? typedLines : null,
    );

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
    const paymentMap = new Map<string, { paymentCount: number; revenue: number }>();
    for (const o of ordersForBreakdown) {
      for (const row of effectivePaymentRows(o, paymentsByOrder.get(o.id) || [])) {
        const bucket = paymentMap.get(row.method) ?? { paymentCount: 0, revenue: 0 };
        bucket.paymentCount += 1;
        bucket.revenue += Number(row.amount) || 0;
        paymentMap.set(row.method, bucket);
      }
    }
    const paymentBreakdown = Array.from(paymentMap.entries())
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    const canonicalModifiers = buildCanonicalModifierLookup(modifiers as any[]);

    // Group by the category written on the sold line (BR-SALE-002), never the dish's group today.
    const typeIdOfCategory = new Map<string, string>((categories as any[]).map(c => [c.id, c.type_id]));
    const drinkTypeIds = new Set((productTypes as any[]).filter(t => t.is_drink).map(t => t.id));
    const categoryName = new Map<string, string>((categories as any[]).map(c => [c.id, c.name]));
    const linesByCategory = new Map<string, OrderLineV2[]>();
    for (const l of typedLines) {
      const categoryOfLine = JSON.parse(l.product_snapshot_json || "{}").category_id || "";
      const group = linesByCategory.get(categoryOfLine) ?? [];
      group.push(l);
      linesByCategory.set(categoryOfLine, group);
    }

    const drinksMap = new Map<string, BestSeller>();
    const foodsMap = new Map<string, BestSeller>();
    const bestToppingsMap = new Map<string, any>();
    const categoryRevenue = new Map<string, number>();
    const uniqueSizesSet = new Set<string>();
    let toppingRevenue = 0;

    for (const [lineCategoryId, groupLines] of linesByCategory) {
      const sellersMap = drinkTypeIds.has(typeIdOfCategory.get(lineCategoryId) ?? "") ? drinksMap : foodsMap;
      for (const r of breakdownRevenueByProduct(typedOrders, groupLines)) {
        // Topping key: MOD-prefix (add-on) or standalone topping mapped via CAT-007 link
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
          const row = bestToppingsMap.get(canonical.id) ?? { modifier_id: canonical.id, name: canonical.name, qty: 0, revenue: 0 };
          row.qty += r.qty;
          row.revenue += r.revenue;
          bestToppingsMap.set(canonical.id, row);
          toppingRevenue += r.revenue;
        } else {
          const row = sellersMap.get(r.product_id)
            ?? { product_id: r.product_id, name: r.product_name, totalQty: 0, totalRevenue: 0, sizes: {} };
          row.totalQty += r.qty;
          row.totalRevenue += r.revenue;
          if (r.size_name) {
            row.sizes[r.size_name] = (row.sizes[r.size_name] || 0) + r.qty;
            uniqueSizesSet.add(r.size_name);
          }
          sellersMap.set(r.product_id, row);
          const label = categoryName.get(lineCategoryId) ?? "Khác";
          categoryRevenue.set(label, (categoryRevenue.get(label) ?? 0) + r.revenue);
        }
      }
    }

    const byQtyDesc = (a: BestSeller, b: BestSeller) => b.totalQty - a.totalQty;
    const bestDrinks = Array.from(drinksMap.values()).sort(byQtyDesc);
    const bestFoods = Array.from(foodsMap.values()).sort(byQtyDesc);
    const bestToppings = Array.from(bestToppingsMap.values()).sort((a, b) => b.qty - a.qty);
    const uniqueSizes = Array.from(uniqueSizesSet).sort();
    const categorySales = [
      ...Array.from(categoryRevenue, ([label, amount]) => ({ label, amount: Math.round(amount) })),
      ...(toppingRevenue ? [{ label: "Topping", amount: Math.round(toppingRevenue) }] : []),
    ];

    // Time series (use typedOrders if no category, else filter orders to those containing lines)
    let timeSeriesOrders = typedOrders;
    if (categoryId) {
      const validOrderIds = new Set(typedLines.map(l => l.order_id));
      timeSeriesOrders = typedOrders.filter(o => validOrderIds.has(o.id));
    }

    // Built once; was a full lines scan per order (B7).
    const categoryRevenueByOrder = categoryId ? sumNetByOrder(typedLines) : null;

    const byDate = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const byDayOfWeek = new Map<string, number>();
    const byHour = new Map<string, number>();

    // Per that plan: all four
    // series bucket by the Saigon calendar date/hour, not toISOString()
    // (always UTC) or getDay()/getHours() (the runtime's local zone -- UTC
    // on Vercel, which is why this was wrong there but not on a machine
    // whose local zone already happens to be Asia/Ho_Chi_Minh).
    for (const o of timeSeriesOrders) {
      if (!o.created_at) continue;
      const rev = categoryRevenueByOrder ? (categoryRevenueByOrder.get(o.id) ?? 0) : o.net_total;

      const { dateKey, monthKey, dowLabel, hourKey } = saigonBucketKeys(o.created_at);
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + rev);
      byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + rev);
      byDayOfWeek.set(dowLabel, (byDayOfWeek.get(dowLabel) || 0) + rev);
      byHour.set(hourKey, (byHour.get(hourKey) || 0) + rev);
    }

    // section 6b.
    // Same order set and per-order revenue as the time series above, so this
    // sums to totalRevenue/totalOrders for the same period. Orders with no
    // outlet_id (pre-backfill history) are kept under key "" rather than
    // dropped, so the sum-check catches a bug instead of hiding one.
    const outletNameById = new Map<string, string>(
      (outlets as any[]).map(o => [String(o.id), String(o.name)]),
    );
    const outletBuckets = new Map<string, { orderCount: number; revenue: number }>();
    for (const o of timeSeriesOrders) {
      const rev = categoryRevenueByOrder ? (categoryRevenueByOrder.get(o.id) ?? 0) : o.net_total;
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
      paymentOrderCount: ordersForBreakdown.length,
      bestDrinks,
      bestFoods,
      categorySales,
      bestToppings,
      uniqueSizes,
      salesByDate: sortMap(byDate),
      salesByMonth: sortMap(byMonth),
      salesByDayOfWeek,
      salesByHour: sortMap(byHour),
      outletBreakdown,
      v2OrderCount: typedOrders.length,
    };
  } catch (err: any) {
    // not in the plan's own list (found while re-deriving it). Rethrow
    // instead of a fabricated zero-revenue report; app/error.tsx handles it.
    console.error("[getSalesDataV2]", err);
    throw err;
  }
}
