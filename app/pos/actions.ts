"use server";

import { findAll, findAllNoCache, findAllWhere, insert, update, remove } from "@/lib/sheets_db";
import type { SheetFilter } from "@/lib/sheets_db";
import { revalidatePath, unstable_cache } from "next/cache";
import { resolveActor } from "@/lib/auth";
import crypto from "node:crypto";

import { buildOrderFromCart } from "@/lib/order-cart";
import { EVENT_TYPE, ORDER_STATUS, coerceOrderV2, coerceLineV2 } from "@/lib/order-types";
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
    if (!input.outlet_id) {
      return { success: false, error: "Không xác định được điểm bán" };
    }

    // 2. Require a real session, or the explicit CLI_MODE system actor.
    const auth = await resolveActor();
    if (!auth.ok) return { success: false, error: auth.error };
    const actor = auth.actor;

    // 3. Load reference data (cached where possible)
    const [outlets, brands, products, variants, categories, modifiers, promotions, baseIngredients] = await Promise.all([
      findAll("Outlets"),
      findAll("Brands"),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Product_Categories"),
      findAll("Modifiers"),
      findAll("Promotions"),
      findAll("Base_Ingredients"),
    ]);

    // docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 5/6:
    // the brand must not be user-suppliable -- resolve it server-side from
    // the outlet and overwrite whatever brand_id the client sent, before
    // buildOrderFromCart (and its promotion filtering) ever sees it.
    const outlet = outlets.find((o: any) => o.id === input.outlet_id);
    if (!outlet) {
      return { success: false, error: "Điểm bán không tồn tại" };
    }
    const resolvedInput = { ...input, brand_id: outlet.brand_id };

    // 4. Build order + lines + snapshots (pure function, internally asserts invariants)
    const built = buildOrderFromCart({ ...resolvedInput, actor }, {
      brands, products, variants, categories, modifiers, promotions, base_ingredients: baseIngredients,
    });
    const saleTime = built.order.created_at;

    // Selling no longer moves stock or determines cost (Plan C Task 3) --
    // cost_at_sale stays at its column default (0), and no stock_ledger row
    // is written here. Recipes and inventory-consumption lookups are gone
    // from checkout entirely, not merely ignored: that lookup was latency on
    // the till for a result nothing reads anymore. As of Phase 2
    // (docs/superpowers/plans/2026-08-27-remove-recipes-and-semi-products.md)
    // the Recipes fetch itself is gone too -- buildOrderFromCart no longer
    // resolves a recipe at all.

    // 5. The database allocates order_no under a transaction lock, keyed by
    // outlet+date (section 4), not brand -- outletCode replaces brandCode.
    const outletCode = outlet.code || "000";

    // 6. Build Order_Events audit record
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

    // 7. Persist the complete bill in one database transaction.
    const saved = await savePosOrderAtomic({
      outletCode,
      order: built.order,
      lines: built.lines,
      event,
      ledgerRows: [],
      clientRequestId: requestToken,
      payments: built.payments,
    });

    // 8. Refresh caches
    // Not revalidating "/pos" here: the only thing on that page fed by
    // fresh server data after a sale (out-of-stock badges) is currently
    // disabled, and POSPage deliberately does not fetch stock status,
    // so revalidating it just re-runs 8 queries for no visible effect. If
    // that feature comes back, prefer a narrower refresh over revalidating
    // the whole page again.
    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin");
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
    // PERF-2 Phase B: read the trigger-maintained balance instead of
    // replaying the whole Stock_Ledger. Cache tag stays "sheets-Stock_Ledger"
    // (not "sheets-Inventory_Balances") -- see the matching comment in
    // app/admin/inventory/actions.ts's loadRealtimeStock.
    const [balances, baseIngredients, semiProducts] = await Promise.all([
      findAllNoCache("Inventory_Balances"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
    ]);
    const stockByItem = new Map<string, number>();
    for (const row of balances as any[]) {
      const itemId = String(row.item_reference || "");
      if (!itemId) continue;
      stockByItem.set(itemId, Number(row.quantity) || 0);
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

// docs/superpowers/plans/2026-08-26-outlet-done-properly.md section 3: a
// draft belongs to the till it was started at, not whatever brand happened
// to be stamped at that moment -- filtered by outlet_id, not brand_id.
export async function getPOSDrafts(outletId: string) {
  const auth = await resolveActor();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const allDrafts = await findAllNoCache("POS_Drafts");
    return allDrafts.filter((d: any) => d.outlet_id === outletId);
  } catch (err: any) {
    // docs/superpowers/plans/2026-08-27-stop-reporting-failures-as-empty.md:
    // not in the plan's own list (found while re-deriving it). Rethrow so
    // the failure is real, not a fabricated "no drafts" -- the caller
    // (components/POSScreen.tsx's refreshDrafts) already has its own
    // try/catch around this call, so this does not reach app/error.tsx's
    // boundary the way the admin loaders do; that presentation gap is a
    // separate, follow-up concern, not this fix.
    console.error("Error getting POS drafts:", err);
    throw err;
  }
}

export async function savePOSDraft(draft: {
  id?: string;
  name: string;
  cart_json: string;
  brand_id: string;
  // Optional only so existing callers/tests that predate this field keep
  // compiling; components/POSScreen.tsx always supplies it. brand_id is
  // kept alongside it -- the sale-time fact, same as on an order -- outlet_id
  // is what filtering now keys on.
  outlet_id?: string;
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
      outlet_id: draft.outlet_id || null,
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

export async function reportPosSyncFailure(
  requestToken: string,
  cartInput: CartInput,
  error?: string,
): Promise<{ success: boolean; error?: string }> {
  const auth = await resolveActor();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    await insert("Pos_Sync_Failures", {
      id: `psf-${crypto.randomUUID()}`,
      request_token: requestToken,
      cart_payload_json: JSON.stringify(cartInput),
      error_message: error || "Unknown error",
      resolved: false,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
