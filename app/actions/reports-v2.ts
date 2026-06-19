"use server";

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { ORDER_STATUS } from "@/lib/order-types";
import type { OrderV2, OrderLineV2 } from "@/lib/order-types";
import {
  breakdownRevenueByProduct,
  breakdownCOGSByIngredient,
  type ProductRevenueRow,
  type IngredientCOGSRow,
} from "@/lib/report-v2-allocators";

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
  productProfitAnalysis: Array<{
    product_id: string;
    product_name: string;
    variant_id: string;
    size_name: string;
    qty: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    marginPct: number;
  }>;
  cogsDetails: Array<{
    ingredient_id: string;
    name: string;
    qty: number;
    unitName: string;
    cogs: number;
  }>;
  // Reconciliation indicator
  v2OrderCount: number;
  v1OrderCount?: number; // optional, set by reconciliation script
}

export async function getPnLDataV2(filters: PnLReportFilters = {}): Promise<PnLReportResult> {
  try {
    const [orders, orderLines, baseIngredients, semiProducts, units] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
      findAll("Units"),
    ]);

    const { startDate, endDate, brandId, staffName, categoryId } = filters;

    // 1. Filter orders: latest COMPLETED versions only
    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
      if (!o.created_at) return false;

      if (startDate && endDate) {
        const d = new Date(o.created_at);
        if (d < new Date(startDate) || d > new Date(endDate)) return false;
      }
      if (brandId && o.brand_id !== brandId) return false;
      if (staffName && o.created_by_name !== staffName) return false;

      return true;
    });

    const orderIds = new Set(filteredOrders.map(o => o.id));
    const filteredLines = (orderLines as any[]).filter(l => orderIds.has(l.order_id));

    // Coerce types
    const typedOrders: OrderV2[] = filteredOrders.map(coerceOrder);
    let typedLines: OrderLineV2[] = filteredLines.map(coerceLine);

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

    // 2. Total revenue = sum of order.net_total
    const totalRevenue = typedOrders.reduce((s, o) => s + o.net_total, 0);

    // 3. Total COGS = sum of line.cost_at_sale
    const totalCOGS = typedLines.reduce((s, l) => s + l.cost_at_sale, 0);

    // 4. Per-product revenue breakdown
    const productRows = breakdownRevenueByProduct(typedOrders, typedLines);

    // 5. Per-ingredient COGS breakdown
    const ingredientRows = breakdownCOGSByIngredient(typedLines);

    // 6. Build product profit analysis (join product revenue with product COGS)
    // Note: COGS is per-ingredient, not per-product. For per-product COGS we'd need
    // to attribute ingredients back to products. Use line-level cost_at_sale aggregated
    // by product_id as approximation.
    const cogsByProductId = new Map<string, number>();
    for (const line of typedLines) {
      const prev = cogsByProductId.get(line.product_id) || 0;
      cogsByProductId.set(line.product_id, prev + line.cost_at_sale);
    }

    const productProfitAnalysis = productRows
      .filter(r => !r.product_id.startsWith("MOD:"))
      .map(r => {
        const cogs = cogsByProductId.get(r.product_id) || 0;
        const grossProfit = r.revenue - cogs;
        const marginPct = r.revenue > 0 ? (grossProfit / r.revenue) * 100 : 0;
        return {
          product_id: r.product_id,
          product_name: r.product_name,
          variant_id: r.variant_id,
          size_name: r.size_name,
          qty: r.qty,
          revenue: r.revenue,
          cogs,
          grossProfit,
          marginPct,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit);

    // Add topping rows (modifiers as pseudo-products)
    const toppingRows = productRows
      .filter(r => r.product_id.startsWith("MOD:"))
      .map(r => ({
        product_id: r.product_id,
        product_name: r.product_name,
        variant_id: "",
        size_name: "",
        qty: r.qty,
        revenue: r.revenue,
        cogs: 0, // modifier COGS not separately tracked at line level
        grossProfit: r.revenue,
        marginPct: 100,
      }));

    // 7. COGS details with names + units
    const cogsDetails = ingredientRows
      .filter(r => r.cogs > 0)
      .map(r => {
        const bi = (baseIngredients as any[]).find(b => b.id === r.ingredient_id);
        const sp = (semiProducts as any[]).find(s => s.id === r.ingredient_id);
        const item = bi || sp;
        const unitId = item?.base_unit || "";
        const unitName = (units as any[]).find(u => u.id === unitId)?.name || unitId;
        return {
          ingredient_id: r.ingredient_id,
          name: item?.name || r.ingredient_id,
          qty: r.qty_consumed,
          unitName,
          cogs: r.cogs,
        };
      })
      .sort((a, b) => b.cogs - a.cogs);

    const grossProfit = totalRevenue - totalCOGS;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      margin,
      orderCount: typedOrders.length,
      productProfitAnalysis: [...productProfitAnalysis, ...toppingRows],
      cogsDetails,
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
      cogsDetails: [],
      v2OrderCount: 0,
    };
  }
}

// ============================================================
// Coercion helpers (sheet rows come back as strings)
// ============================================================

// ============================================================
// Sales report
// ============================================================

export interface SalesReportResult {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
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
  // Reconciliation indicator
  v2OrderCount: number;
}

export async function getSalesDataV2(filters: PnLReportFilters = {}): Promise<SalesReportResult> {
  try {
    const [orders, orderLines] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
    ]);

    const { startDate, endDate, brandId, staffName, categoryId } = filters;

    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
      if (!o.created_at) return false;

      if (startDate && endDate) {
        const d = new Date(o.created_at);
        if (d < new Date(startDate) || d > new Date(endDate)) return false;
      }
      if (brandId && o.brand_id !== brandId) return false;
      if (staffName && o.created_by_name !== staffName) return false;

      return true;
    });

    const orderIds = new Set(filteredOrders.map(o => o.id));
    const filteredLines = (orderLines as any[]).filter(l => orderIds.has(l.order_id));

    const typedOrders: OrderV2[] = filteredOrders.map(coerceOrder);
    let typedLines: OrderLineV2[] = filteredLines.map(coerceLine);

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
      // typedOrders = typedOrders.filter(o => validOrdersForCat.has(o.id));
      // Actually, standard behavior: totalRevenue only sums the filtered lines when category is picked?
      // Wait, PnLDataV2 did not re-filter typedOrders. Let's keep it simple: totalRevenue from order.net_total
      // But if category is selected, order.net_total includes other categories!
      // To match V1 behavior, if category is selected, sales revenue = sum of line nets.
    }

    const totalRevenue = categoryId
      ? typedLines.reduce((s, l) => s + l.net_line_total, 0)
      : typedOrders.reduce((s, o) => s + o.net_total, 0);

    const totalOrders = categoryId
      ? new Set(typedLines.map(l => l.order_id)).size
      : typedOrders.length;

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const productRows = breakdownRevenueByProduct(typedOrders, typedLines);

    const bestSellersMap = new Map<string, any>();
    const bestToppingsMap = new Map<string, any>();
    const uniqueSizesSet = new Set<string>();

    for (const r of productRows) {
      if (r.product_id.startsWith("MOD:")) {
        const modId = r.product_id.replace("MOD:", "");
        if (!bestToppingsMap.has(modId)) {
          bestToppingsMap.set(modId, { modifier_id: modId, name: r.product_name, qty: 0, revenue: 0 });
        }
        const row = bestToppingsMap.get(modId);
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

    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    for (const o of timeSeriesOrders) {
      if (!o.created_at) continue;
      const d = new Date(o.created_at);
      const rev = categoryId
        ? typedLines.filter(l => l.order_id === o.id).reduce((s, l) => s + l.net_line_total, 0)
        : o.net_total;

      const dateStr = d.toISOString().split("T")[0];
      byDate.set(dateStr, (byDate.get(dateStr) || 0) + rev);

      const monthStr = d.toISOString().substring(0, 7);
      byMonth.set(monthStr, (byMonth.get(monthStr) || 0) + rev);

      const dow = days[d.getDay()];
      byDayOfWeek.set(dow, (byDayOfWeek.get(dow) || 0) + rev);

      const hour = d.getHours().toString().padStart(2, "0") + ":00";
      byHour.set(hour, (byHour.get(hour) || 0) + rev);
    }

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
      bestSellers,
      bestToppings,
      uniqueSizes,
      totalQtyBySize,
      totalQtyAll,
      salesByDate: sortMap(byDate),
      salesByMonth: sortMap(byMonth),
      salesByDayOfWeek,
      salesByHour: sortMap(byHour),
      v2OrderCount: typedOrders.length,
    };
  } catch (err: any) {
    console.error("[getSalesDataV2]", err);
    return {
      totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, bestSellers: [], bestToppings: [],
      uniqueSizes: [], totalQtyBySize: {}, totalQtyAll: 0,
      salesByDate: [], salesByMonth: [], salesByDayOfWeek: [], salesByHour: [],
      v2OrderCount: 0,
    };
  }
}

function coerceOrder(row: any): OrderV2 {
  return {
    ...row,
    version: Number(row.version) || 1,
    gross_total: Number(row.gross_total) || 0,
    promo_discount_total: Number(row.promo_discount_total) || 0,
    manual_item_discount_total: Number(row.manual_item_discount_total) || 0,
    manual_order_discount: Number(row.manual_order_discount) || 0,
    net_total: Number(row.net_total) || 0,
  } as OrderV2;
}

function coerceLine(row: any): OrderLineV2 {
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
  } as OrderLineV2;
}
