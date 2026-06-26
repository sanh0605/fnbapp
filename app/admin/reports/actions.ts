"use server";

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { ORDER_STATUS, parseLineRecipeSnapshot, coerceOrderV2, coerceLineV2 } from "@/lib/order-types";
import type { LineRecipeSnapshot, OrderV2, OrderLineV2 } from "@/lib/order-types";
import {
  breakdownRevenueByProduct,
  breakdownCOGSByIngredient,
  type ProductRevenueRow,
  type IngredientCOGSRow,
} from "@/lib/report-v2-allocators";
import { toSaigonUtcRange } from "@/lib/report-time";
import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  type SemiProductConsumptionMaps,
} from "@/lib/inventory-consumption";
import { getMacUnitCostWithRecipeFallback, type MacLedgerEntry } from "@/lib/mac-cogs";

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
    const [orders, orderLines, baseIngredients, semiProducts, units, ledger, recipes, modifiers, products] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
      findAll("Units"),
      findAllNoCache("Stock_Ledger"),
      findAll("Recipes"),
      findAll("Modifiers"),
      findAll("Products"),
    ]);

    // Standalone topping → linked modifier map (CAT-007 products with migration_notes link).
    // See spec 2026-06-27-standalone-topping-report-classification-design.md.
    const standaloneToppingToModId = buildStandaloneToppingMap(products as any[]);

    // Build SemiProductContext for SP-aware COGS computation (WS-10)
    const spRecipes = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT");
    const spYields = new Map<string, number>();
    for (const sp of semiProducts as any[]) {
      spYields.set(sp.id, Number(sp.batch_yield) || 1);
    }
    const spContext = { recipes: spRecipes, yields: spYields };

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

    // 3. Total COGS = sum of line.cost_at_sale
    const totalCOGS = typedLines.reduce((s, l) => s + l.cost_at_sale, 0);

    // 4. Per-product revenue breakdown
    const productRows = breakdownRevenueByProduct(typedOrders, typedLines);

    // 5. Per-ingredient COGS breakdown
    const ingredientRows = breakdownCOGSByIngredient(typedLines, typedOrders, ledger as any[], spContext);

    // 6. Build product profit analysis.
    // COGS is split by source so product rows do not also carry topping COGS.
    const cogsBySourceKey = splitLineCogsBySaleSource(typedLines, typedOrders, ledger as any[], spContext);
    const canonicalModifiers = buildCanonicalModifierLookup(modifiers as any[]);
    const canonicalModifierCogs = canonicalizeModifierCogs(cogsBySourceKey.modifierCogs, canonicalModifiers);

    const productProfitAnalysis = productRows
      .filter(r => !r.product_id.startsWith("MOD:") && !standaloneToppingToModId.has(r.product_id))
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

    // Add topping rows (modifiers as pseudo-products + standalone toppings merged via modId)
    const toppingRevenueRows = mergeModifierRevenueRows(productRows, canonicalModifiers);

    // Aggregate standalone topping revenue + COGS by linked modifier ID
    const standaloneByModId = new Map<string, { qty: number; revenue: number; cogs: number; name: string }>();
    for (const r of productRows) {
      const modId = standaloneToppingToModId.get(r.product_id);
      if (!modId) continue;
      const key = `${r.product_id}__${r.variant_id}`;
      const cogs = cogsBySourceKey.variantCogs.get(key) || 0;
      const existing = standaloneByModId.get(modId);
      if (existing) {
        existing.qty += r.qty;
        existing.revenue += r.revenue;
        existing.cogs += cogs;
      } else {
        standaloneByModId.set(modId, { qty: r.qty, revenue: r.revenue, cogs, name: r.product_name });
      }
    }

    // Build a combined toppingRows map keyed by `MOD:<id>` so standalone merges with add-on
    const toppingRowMap = new Map<string, {
      product_id: string;
      product_name: string;
      qty: number;
      revenue: number;
      cogs: number;
    }>();
    for (const r of toppingRevenueRows) {
      toppingRowMap.set(r.product_id, {
        product_id: r.product_id,
        product_name: r.product_name,
        qty: r.qty,
        revenue: r.revenue,
        cogs: canonicalModifierCogs.get(r.product_id.replace("MOD:", "")) || 0,
      });
    }
    for (const [modId, agg] of standaloneByModId) {
      const key = `MOD:${modId}`;
      const existing = toppingRowMap.get(key);
      if (existing) {
        existing.qty += agg.qty;
        existing.revenue += agg.revenue;
        existing.cogs += agg.cogs;
      } else {
        toppingRowMap.set(key, {
          product_id: key,
          product_name: agg.name,
          qty: agg.qty,
          revenue: agg.revenue,
          cogs: agg.cogs,
        });
      }
    }

    const toppingRows = Array.from(toppingRowMap.values()).map(r => {
      const grossProfit = r.revenue - r.cogs;
      const marginPct = r.revenue > 0 ? (grossProfit / r.revenue) * 100 : 0;
      return {
        product_id: r.product_id,
        product_name: r.product_name,
        variant_id: "",
        size_name: "",
        qty: r.qty,
        revenue: r.revenue,
        cogs: r.cogs,
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
    const cogsDetailDelta = totalCOGS - cogsDetails.reduce((sum, row) => sum + row.cogs, 0);
    if (cogsDetails.length > 0 && Math.abs(cogsDetailDelta) > 0.000001) {
      cogsDetails[0] = {
        ...cogsDetails[0],
        cogs: cogsDetails[0].cogs + cogsDetailDelta,
      };
    }

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
  // Reconciliation indicator
  v2OrderCount: number;
}

export async function getSalesDataV2(filters: PnLReportFilters = {}): Promise<SalesReportResult> {
  try {
    const [orders, orderLines, modifiers, products] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAll("Modifiers"),
      findAll("Products"),
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
    const paymentMap = new Map<string, { orderCount: number; revenue: number }>();
    for (const o of ordersForBreakdown) {
      const method = o.payment_method || "UNKNOWN";
      if (!paymentMap.has(method)) paymentMap.set(method, { orderCount: 0, revenue: 0 });
      const row = paymentMap.get(method)!;
      row.orderCount += 1;
      row.revenue += o.net_total;
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
      v2OrderCount: 0,
    };
  }
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

  const sortedLines = [...lines].sort((a, b) => {
    const aTime = orderById.get(a.order_id)?.created_at || "";
    const bTime = orderById.get(b.order_id)?.created_at || "";
    return new Date(aTime || 0).getTime() - new Date(bTime || 0).getTime();
  });

  for (const line of sortedLines) {
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    const variantKey = `${line.product_id}__${line.variant_id}`;
    const saleTime = orderById.get(line.order_id)?.created_at || "";
    const saleMs = new Date(saleTime || 0).getTime();
    const ledgerBeforeSale = Number.isFinite(saleMs)
      ? (ledger as MacLedgerEntry[]).filter(row => new Date(row.created_at || 0).getTime() < saleMs)
      : (ledger as MacLedgerEntry[]);
    const allocations = computeSourceCogsForLine(
      recipe,
      ledger as MacLedgerEntry[],
      ledgerBeforeSale,
      saleTime,
      line.qty,
      toConsumptionMaps(spContext),
      toMacSemiProductContext(spContext),
    );
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
  ledger: MacLedgerEntry[],
  ledgerBeforeSale: MacLedgerEntry[],
  saleTime: string,
  lineQty: number,
  consumptionMaps: SemiProductConsumptionMaps,
  macContext: ReturnType<typeof toMacSemiProductContext>,
): { variant: number; modifiers: Array<{ modifierId: string; cogs: number }> } {
  const variantOnly = { variant: recipe.variant, modifiers: [] };
  const variant = computeRawMacWeight(variantOnly, ledger, ledgerBeforeSale, saleTime, lineQty, consumptionMaps, macContext);

  const modifiers = recipe.modifiers.map(modifier => {
    const modifierOnly = {
      variant: { target_type: "PRODUCT_VARIANT" as const, target_id: "", ingredients: [] as any[] },
      modifiers: [modifier],
    };
    return {
      modifierId: modifier.modifier_id,
      cogs: computeRawMacWeight(modifierOnly, ledger, ledgerBeforeSale, saleTime, lineQty, consumptionMaps, macContext),
    };
  });

  return { variant, modifiers };
}

function computeRawMacWeight(
  recipe: LineRecipeSnapshot,
  ledger: MacLedgerEntry[],
  ledgerBeforeSale: MacLedgerEntry[],
  saleTime: string,
  lineQty: number,
  consumptionMaps: SemiProductConsumptionMaps,
  macContext: ReturnType<typeof toMacSemiProductContext>,
): number {
  const balances = buildInventoryBalances(ledgerBeforeSale, saleTime);
  const rows = buildLineConsumptionRows(recipe, lineQty, balances, consumptionMaps);
  return rows.reduce((sum, row) => {
    const unitCost = getMacUnitCostWithRecipeFallback(row.item_reference, ledger, saleTime, macContext);
    return sum + row.quantity * unitCost;
  }, 0);
}

function addMoney(map: Map<string, number>, key: string, value: number): void {
  if (!key || !Number.isFinite(value) || value === 0) return;
  map.set(key, (map.get(key) || 0) + value);
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

function canonicalizeModifierCogs(
  modifierCogs: Map<string, number>,
  canonicalModifiers: ReturnType<typeof buildCanonicalModifierLookup>,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const [modifierId, cogs] of modifierCogs.entries()) {
    const canonical = canonicalModifiers.byId.get(modifierId) || { id: modifierId, name: modifierId };
    addMoney(result, canonical.id, cogs);
  }
  return result;
}

function toConsumptionMaps(spContext?: any): SemiProductConsumptionMaps {
  const semiProductRecipes = new Map();
  const semiProductYields = new Map();

  if (spContext?.semiProductRecipes instanceof Map) {
    for (const [id, recipe] of spContext.semiProductRecipes.entries()) semiProductRecipes.set(id, recipe);
  }
  if (spContext?.semiProductYields instanceof Map) {
    for (const [id, yieldQty] of spContext.semiProductYields.entries()) semiProductYields.set(id, yieldQty);
  }
  if (Array.isArray(spContext?.recipes)) {
    for (const recipe of spContext.recipes) {
      if (!recipe.target_id || !recipe.ingredients_json) continue;
      semiProductRecipes.set(recipe.target_id, parseSemiProductIngredients(recipe.ingredients_json, recipe.target_id));
    }
  }
  if (spContext?.yields instanceof Map) {
    for (const [id, yieldQty] of spContext.yields.entries()) semiProductYields.set(id, yieldQty);
  }

  return { semiProductRecipes, semiProductYields };
}

function toMacSemiProductContext(spContext?: any) {
  const maps = toConsumptionMaps(spContext);
  return {
    semiProductRecipes: maps.semiProductRecipes,
    semiProductYields: maps.semiProductYields,
  };
}

function parseSemiProductIngredients(ingredientsJson: string, semiProductId: string): any[] {
  try {
    const parsed = JSON.parse(ingredientsJson || "[]");
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    throw new Error(`SEMI_PRODUCT ${semiProductId} has malformed ingredients_json: ${(err as Error).message}`);
  }
  throw new Error(`SEMI_PRODUCT ${semiProductId} ingredients_json is not an array`);
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
    if (match) map.set(String(p.id), match[1]);
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
  try {
    const orders = await findAllNoCache("Orders_V2");
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
  try {
    const [orders, promotions] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAll("Promotions"),
    ]);

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
