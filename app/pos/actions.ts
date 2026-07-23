"use server";

import { findAll, findAllNoCache, findAllWhere, insert, update, remove } from "@/lib/sheets_db";
import type { SheetFilter } from "@/lib/sheets_db";
import { revalidatePath, unstable_cache } from "next/cache";
import { resolveActor } from "@/lib/auth";
import crypto from "node:crypto";

import { buildOrderFromCart } from "@/lib/order-cart";
import { EVENT_TYPE, ORDER_STATUS, coerceOrderV2, coerceLineV2 } from "@/lib/order-types";
import { parseLineRecipeSnapshot } from "@/lib/order-types";
import { computeMacCostFromUnitCosts } from "@/lib/mac-cogs";
import {
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
  splitImplicitProduction,
  type ConsumptionRow,
} from "@/lib/inventory-consumption";
import { getPosInventoryState } from "@/lib/pos-inventory-state";
import { savePosOrderAtomic } from "@/lib/pos-order-transaction";
import { breakdownRevenueByProduct } from "@/lib/report-v2-allocators";
import { toSaigonUtcRange } from "@/lib/report-time";
import type { CartInput } from "@/lib/order-cart";

export type SubmitOrderV2Result = {
  success: true;
  order_id: string;
  order_no: string;
} | {
  success: false;
  error: string;
};

export type PosBestSellerFilters = {
  startDate?: string;
  endDate?: string;
  brandId?: string;
  limit?: number;
};

export type PosStockStatus = {
  id: string;
  current_stock: number;
};

export async function submitOrderV2(
  input: CartInput,
  requestToken?: string,
): Promise<SubmitOrderV2Result> {
  try {
    // 1. Validate input
    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Giỏ hàng trống" };
    }
    if (!input.brand_id) {
      return { success: false, error: "Không xác định được thương hiệu" };
    }

    // 2. Require a real session, or the explicit CLI_MODE system actor.
    const auth = await resolveActor();
    if (!auth.ok) return { success: false, error: auth.error };
    const actor = auth.actor;

    // 3. Load reference data (cached where possible)
    const [brands, products, variants, categories, modifiers, promotions, recipes, baseIngredients, semiProducts] = await Promise.all([
      findAll("Brands"),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Product_Categories"),
      findAll("Modifiers"),
      findAll("Promotions"),
      findAll("Recipes"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
    ]);
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[]);

    // 4. Build order + lines + snapshots (pure function, internally asserts invariants)
    const built = buildOrderFromCart({ ...input, actor }, {
      brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients,
    });

    // 5. Load compact inventory state and compute COGS per line.
    const saleTime = built.order.created_at;
    const inventoryState = await getPosInventoryState(saleTime);
    const lineConsumptions: LineConsumption[] = [];
    for (const line of built.lines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const implicitYields = new Map<string, number>();
      const consumptionRows = buildLineConsumptionRows(
        lineRecipe,
        line.qty,
        inventoryState.balances,
        consumptionMaps,
        implicitYields,
      );
      lineConsumptions.push({ rows: consumptionRows, implicitYields });
      // COGS is computed from the original consumption rows, unaffected by
      // how the shortfall portion later gets split into an implicit
      // production step below -- a semi-product's MAC cost already falls
      // back to its recipe's raw-ingredient cost, so costing "50 of BTP" is
      // mathematically identical to costing "30 of BTP + 20 of its raw
      // equivalent" (see docs/superpowers/plans/2026-07-20-implicit-production-shortfall-design.md).
      line.cost_at_sale = computeMacCostFromUnitCosts(
        consumptionRows,
        inventoryState.macUnitCosts,
        consumptionMaps,
      );
    }

    // 6. The database allocates order_no under a transaction lock.
    const brand = brands.find(b => b.id === input.brand_id);
    const brandCode = brand?.code || "ORD";

    // 7. Build Order_Events audit record
    const event = {
      id: `evt-${crypto.randomUUID()}`,
      order_id: built.order.id,
      event_type: EVENT_TYPE.CREATED,
      event_at: saleTime,
      actor_id: actor.id,
      actor_name: actor.name,
      from_version: "" as const,
      to_version: 1,
      previous_order_id: "" as const,
      delta_json: JSON.stringify({
        line_count: built.lines.length,
        gross_total: built.order.gross_total,
        net_total: built.order.net_total,
      }),
      reason: "POS checkout",
    };

    // 8. Build Stock_Ledger entries (one per ingredient per line)
    const ledgerEntries = buildStockLedgerEntries(
      built.order.id,
      event.id,
      saleTime,
      lineConsumptions,
    );

    // 9. Persist the complete bill in one database transaction.
    const saved = await savePosOrderAtomic({
      brandCode,
      order: built.order,
      lines: built.lines,
      event,
      ledgerRows: ledgerEntries,
      clientRequestId: requestToken,
      payments: built.payments,
    });

    // 10. Refresh caches
    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin");
      revalidatePath("/pos");
    }

    return {
      success: true,
      order_id: saved.orderId,
      order_no: saved.orderNo,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

type LineConsumption = {
  rows: ConsumptionRow[];
  implicitYields: Map<string, number>;
};

function buildStockLedgerEntries(
  orderId: string,
  eventId: string,
  saleTime: string,
  lineConsumptions: LineConsumption[],
) {
  const entries: any[] = [];
  for (const { rows, implicitYields } of lineConsumptions) {
    const { saleRows, productionConsumeRows, productionYieldRows } =
      splitImplicitProduction(rows, implicitYields);

    // A semi-product shortfall means raw ingredients had to be implicitly
    // "brewed" into the semi-product before the sale could consume it --
    // record that production step explicitly instead of debiting raw
    // ingredients as if they were served to the customer directly. See
    // docs/superpowers/plans/2026-07-20-implicit-production-shortfall-design.md.
    for (const row of productionConsumeRows) {
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "PRODUCTION_CONSUME",
        reference_id: orderId,
        item_reference: row.item_reference,
        quantity_change: -row.quantity,
        unit_cost: 0,
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: 0,
        source: row.source,
      });
    }
    for (const yieldRow of productionYieldRows) {
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "PRODUCTION_YIELD",
        reference_id: orderId,
        item_reference: yieldRow.item_reference,
        quantity_change: yieldRow.quantity,
        unit_cost: 0,
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: 0,
        source: "AUTO_SHORTFALL_PRODUCTION",
      });
    }

    for (const row of saleRows) {
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: orderId,
        item_reference: row.item_reference,
        quantity_change: -row.quantity,
        unit_cost: 0,
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: 0, // simplified: per-ingredient MAC refinement deferred
        source: row.source,
      });
    }
  }
  return entries;
}

// Claude code — R12: buildLineConsumptionRows extracted to lib/inventory-consumption.ts (shared).

export async function getPOSBestSellerProductIds(
  filters: PosBestSellerFilters = {},
): Promise<string[]> {
  const auth = await resolveActor();
  if (!auth.ok) throw new Error(auth.error);

  const dateRange = toSaigonUtcRange(filters.startDate, filters.endDate);
  const orderQuery: SheetFilter = { eq: { status: ORDER_STATUS.COMPLETED } };
  if (dateRange) {
    orderQuery.gte = { created_at: dateRange.startUtc };
    orderQuery.lte = { created_at: dateRange.endUtc };
  }

  // Order_Lines_V2 grows unboundedly with order history (2,300+ rows and
  // counting) -- fetching the whole table on every POS page load (this
  // function is uncached, called fresh after every checkout via
  // revalidatePath("/pos")) was measured at 1.5s+ alone. Scope the fetch to
  // the same date window used for orders, matching the actual "best sellers
  // this week" use case -- no caller needs full history here.
  const lineQuery: SheetFilter = {};
  if (dateRange) {
    lineQuery.gte = { created_at: dateRange.startUtc };
    lineQuery.lte = { created_at: dateRange.endUtc };
  }

  const [orders, orderLines, products] = await Promise.all([
    findAllWhere("Orders_V2", orderQuery),
    dateRange ? findAllWhere("Order_Lines_V2", lineQuery) : findAllNoCache("Order_Lines_V2"),
    findAll("Products"),
  ]);
  const eligibleOrders = (orders as any[]).filter((order) => {
    if (order.status !== ORDER_STATUS.COMPLETED) return false;
    if (order.superseded_by) return false;
    if (!order.created_at) return false;
    if (dateRange) {
      const createdAt = new Date(order.created_at);
      if (createdAt < dateRange.startUtc || createdAt > dateRange.endUtc) return false;
    }
    return !filters.brandId || order.brand_id === filters.brandId;
  });
  const eligibleOrderIds = new Set(eligibleOrders.map((order) => order.id));
  const eligibleLines = (orderLines as any[]).filter((line) => eligibleOrderIds.has(line.order_id));
  const productRows = breakdownRevenueByProduct(
    eligibleOrders.map(coerceOrderV2),
    eligibleLines.map(coerceLineV2),
  );
  const standaloneToppingIds = new Set(
    (products as any[])
      .filter((product) => (
        String(product.category_id) === "CAT-007"
        && /topping-standalone::mod_id=MOD-\d+/.test(String(product.migration_notes || ""))
      ))
      .map((product) => String(product.id)),
  );
  const quantityByProduct = new Map<string, number>();
  for (const row of productRows) {
    if (row.product_id.startsWith("MOD:") || standaloneToppingIds.has(row.product_id)) continue;
    quantityByProduct.set(
      row.product_id,
      (quantityByProduct.get(row.product_id) || 0) + row.qty,
    );
  }
  const limit = Number.isFinite(filters.limit)
    ? Math.max(0, Math.floor(filters.limit as number))
    : 8;
  return Array.from(quantityByProduct.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([productId]) => productId);
}

const loadPOSStockStatus = unstable_cache(
  async (): Promise<PosStockStatus[]> => {
    const [stockLedger, baseIngredients, semiProducts] = await Promise.all([
      findAllNoCache("Stock_Ledger"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
    ]);
    const stockByItem = new Map<string, number>();
    for (const entry of stockLedger as any[]) {
      const itemId = String(entry.item_reference || "");
      if (!itemId) continue;
      stockByItem.set(itemId, (stockByItem.get(itemId) || 0) + Number(entry.quantity_change || 0));
    }
    const inventoryItems = [
      ...(baseIngredients as any[]).filter((item) => (
        item.is_non_inventory !== true && item.is_non_inventory !== "TRUE"
      )),
      ...(semiProducts as any[]),
    ];
    return inventoryItems.map((item) => ({
      id: String(item.id),
      current_stock: stockByItem.get(String(item.id)) || 0,
    }));
  },
  ["pos-stock-status"],
  {
    revalidate: 60,
    tags: ["sheets-Stock_Ledger", "sheets-Base_Ingredients", "sheets-Semi_Products"],
  },
);

export async function getPOSStockStatus(): Promise<PosStockStatus[]> {
  const auth = await resolveActor();
  if (!auth.ok) throw new Error(auth.error);
  return loadPOSStockStatus();
}

export async function getPOSDrafts(brandId: string) {
  const auth = await resolveActor();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const allDrafts = await findAllNoCache("POS_Drafts");
    return allDrafts.filter((d: any) => d.brand_id === brandId);
  } catch (err: any) {
    console.error("Error getting POS drafts:", err);
    return [];
  }
}

export async function savePOSDraft(draft: {
  id?: string;
  name: string;
  cart_json: string;
  brand_id: string;
}) {
  try {
    const auth = await resolveActor();
    if (!auth.ok) return { success: false as const, error: auth.error };
    const actor = auth.actor;

    const now = new Date().toISOString();
    
    if (draft.id) {
      const allDrafts = await findAllNoCache("POS_Drafts");
      const existing = allDrafts.find((d: any) => d.id === draft.id);
      if (existing) {
        const updated = await update("POS_Drafts", draft.id, {
          name: draft.name,
          cart_json: draft.cart_json,
          timestamp: now,
        });
        return { success: true as const, draft: updated };
      }
    }

    const newId = draft.id || `drf-${crypto.randomUUID()}`;
    const newDraft = {
      id: newId,
      timestamp: now,
      name: draft.name,
      cart_json: draft.cart_json,
      brand_id: draft.brand_id,
      created_by_id: actor.id,
      created_by_name: actor.name,
      created_at: now,
    };
    await insert("POS_Drafts", newDraft);
    return { success: true as const, draft: newDraft };
  } catch (err: any) {
    return { success: false as const, error: err?.message || String(err) };
  }
}

export async function deletePOSDraft(draftId: string) {
  try {
    const auth = await resolveActor();
    if (!auth.ok) return { success: false as const, error: auth.error };

    await remove("POS_Drafts", draftId);
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || String(err) };
  }
}
