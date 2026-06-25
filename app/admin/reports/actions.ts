"use server";

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { ORDER_STATUS, parseLineRecipeSnapshot } from "@/lib/order-types";
import type { LineRecipeSnapshot, OrderV2, OrderLineV2 } from "@/lib/order-types";
import { computeLineCostFIFO } from "@/lib/order-cogs-fifo";
import { FIFOTracker } from "@/lib/fifo-tracker";
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
    const [orders, orderLines, baseIngredients, semiProducts, units, ledger, recipes] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
      findAll("Units"),
      findAllNoCache("Stock_Ledger"),
      findAll("Recipes"),
    ]);

    // Build SemiProductContext for SP-aware COGS computation (WS-10)
    const spRecipes = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT");
    const spYields = new Map<string, number>();
    for (const sp of semiProducts as any[]) {
      spYields.set(sp.id, Number(sp.batch_yield) || 1);
    }
    const spContext = { recipes: spRecipes, yields: spYields };

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

    const reportOrderCount = categoryId
      ? new Set(typedLines.map(line => line.order_id)).size
      : typedOrders.length;

    // 2. Total revenue. With category filter, only revenue from matching lines belongs in the report.
    const totalRevenue = categoryId
      ? typedLines.reduce((s, line) => s + line.net_line_total, 0)
      : typedOrders.reduce((s, o) => s + o.net_total, 0);

    // 3. Total COGS = sum of line.cost_at_sale
    const totalCOGS = typedLines.reduce((s, l) => s + l.cost_at_sale, 0);

    // 4. Per-product revenue breakdown
    const productRows = breakdownRevenueByProduct(typedOrders, typedLines);

    // 5. Per-ingredient COGS breakdown
    const ingredientRows = breakdownCOGSByIngredient(typedLines, typedOrders, ledger as any[], spContext);

    // 6. Build product profit analysis.
    // COGS is split by source so product rows do not also carry topping COGS.
    const cogsBySourceKey = splitLineCogsBySaleSource(typedLines, typedOrders, ledger as any[], spContext);

    const productProfitAnalysis = productRows
      .filter(r => !r.product_id.startsWith("MOD:"))
      .map(r => {
        const key = `${r.product_id}__${r.variant_id}`;
        const cogs = cogsBySourceKey.variantCogs.get(key) || 0;
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
      .sort((a, b) => b.qty - a.qty || b.grossProfit - a.grossProfit);

    // Add topping rows (modifiers as pseudo-products)
    const toppingRows = productRows
      .filter(r => r.product_id.startsWith("MOD:"))
      .map(r => {
        const modifierId = r.product_id.replace("MOD:", "");
        const cogs = cogsBySourceKey.modifierCogs.get(modifierId) || 0;
        const grossProfit = r.revenue - cogs;
        const marginPct = r.revenue > 0 ? (grossProfit / r.revenue) * 100 : 0;
        return {
          product_id: r.product_id,
          product_name: r.product_name,
          variant_id: "",
          size_name: "",
          qty: r.qty,
          revenue: r.revenue,
          cogs,
          grossProfit,
          marginPct,
        };
      });

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
      orderCount: reportOrderCount,
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

function splitLineCogsBySaleSource(
  lines: OrderLineV2[],
  orders: OrderV2[],
  ledger: any[],
  spContext?: any,
): { variantCogs: Map<string, number>; modifierCogs: Map<string, number> } {
  const variantCogs = new Map<string, number>();
  const modifierCogs = new Map<string, number>();
  const orderById = new Map(orders.map(order => [order.id, order]));
  const tracker = new FIFOTracker();
  tracker.init(ledger);

  const sortedLines = [...lines].sort((a, b) => {
    const aTime = orderById.get(a.order_id)?.created_at || "";
    const bTime = orderById.get(b.order_id)?.created_at || "";
    return new Date(aTime || 0).getTime() - new Date(bTime || 0).getTime();
  });

  for (const line of sortedLines) {
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    const variantKey = `${line.product_id}__${line.variant_id}`;
    const allocations = computeSourceCogsForLine(recipe, tracker, line.qty, spContext);
    const rawTotal = allocations.variant + allocations.modifiers.reduce((sum, modifier) => sum + modifier.cogs, 0);

    if (rawTotal <= 0) {
      addMoney(variantCogs, variantKey, line.cost_at_sale);
      continue;
    }

    const targetTotal = line.cost_at_sale || rawTotal;
    const scale = targetTotal / rawTotal;
    let allocatedTotal = 0;

    const scaledVariant = Math.round(allocations.variant * scale);
    allocatedTotal += scaledVariant;
    addMoney(variantCogs, variantKey, scaledVariant);

    allocations.modifiers.forEach((modifier, index) => {
      const isLast = index === allocations.modifiers.length - 1;
      const scaled = isLast
        ? targetTotal - allocatedTotal
        : Math.round(modifier.cogs * scale);
      allocatedTotal += scaled;
      addMoney(modifierCogs, modifier.modifierId, scaled);
    });

    if (allocations.modifiers.length === 0 && allocatedTotal !== targetTotal) {
      addMoney(variantCogs, variantKey, targetTotal - allocatedTotal);
    }
  }

  return { variantCogs, modifierCogs };
}

function computeSourceCogsForLine(
  recipe: LineRecipeSnapshot,
  tracker: FIFOTracker,
  lineQty: number,
  spContext?: any,
): { variant: number; modifiers: Array<{ modifierId: string; cogs: number }> } {
  const variantOnly = { variant: recipe.variant, modifiers: [] };
  const variant = computeLineCostFIFO(variantOnly, tracker, lineQty, spContext);

  const modifiers = recipe.modifiers.map(modifier => {
    const modifierOnly = {
      variant: { target_type: "PRODUCT_VARIANT" as const, target_id: "", ingredients: [] as any[] },
      modifiers: [modifier],
    };
    return {
      modifierId: modifier.modifier_id,
      cogs: computeLineCostFIFO(modifierOnly, tracker, lineQty, spContext),
    };
  });

  return { variant, modifiers };
}

function addMoney(map: Map<string, number>, key: string, value: number): void {
  if (!key || !Number.isFinite(value) || value === 0) return;
  map.set(key, (map.get(key) || 0) + value);
}

export interface HeatmapCell {
  dayOfWeek: string;
  hour: number;
  revenue: number;
  orderCount: number;
}

export async function getHourlyHeatmapV2(filters: PnLReportFilters = {}): Promise<HeatmapCell[]> {
  try {
    const orders = await findAllNoCache("Orders_V2");
    const { startDate, endDate, brandId } = filters;

    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
      if (!o.created_at) return false;

      if (startDate && endDate) {
        const d = new Date(o.created_at);
        if (d < new Date(startDate) || d > new Date(endDate)) return false;
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
  try {
    const [orders, promotions] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAll("Promotions"),
    ]);

    const { startDate, endDate, brandId } = filters;

    const filteredOrders = (orders as any[]).filter(o => {
      if (o.status !== ORDER_STATUS.COMPLETED) return false;
      if (o.superseded_by && o.superseded_by !== "") return false;
      if (!o.created_at) return false;

      if (startDate && endDate) {
        const d = new Date(o.created_at);
        if (d < new Date(startDate) || d > new Date(endDate)) return false;
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
