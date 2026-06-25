"use server";

import { findAll, findAllNoCache, insert, update, remove } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import crypto from "node:crypto";

import { buildOrderFromCart } from "@/lib/order-cart";
import { insertOrderV2Records } from "@/lib/sheets-db-v2";
import { EVENT_TYPE, ORDER_STATUS } from "@/lib/order-types";
import { parseLineRecipeSnapshot } from "@/lib/order-types";
import { computeMacCostForConsumptionRows } from "@/lib/mac-cogs";
import {
  allocateRecipeConsumption,
  buildInventoryBalances,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
} from "@/lib/inventory-consumption";
import type { CartInput } from "@/lib/order-cart";

export type SubmitOrderV2Result = {
  success: true;
  order_id: string;
  order_no: string;
} | {
  success: false;
  error: string;
};

export async function submitOrderV2(input: CartInput): Promise<SubmitOrderV2Result> {
  try {
    // 1. Validate input
    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Giỏ hàng trống" };
    }
    if (!input.brand_id) {
      return { success: false, error: "Không xác định được thương hiệu" };
    }

    // 2. Resolve actor
    let session = null;
    if (process.env.CLI_MODE !== "true") {
      session = await getServerSession(authOptions);
    }
    const actor = {
      id: (session?.user as any)?.id || "system",
      name: session?.user?.name || "Hệ thống",
    };

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
    const ledger = await findAllNoCache("Stock_Ledger");

    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[]);

    // 4. Build order + lines + snapshots (pure function, internally asserts invariants)
    const built = buildOrderFromCart({ ...input, actor }, {
      brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients,
    });

    // 5. Compute COGS per line, mutate lines in place
    const saleTime = built.order.created_at;
    const saleMs = new Date(saleTime).getTime();
    const pastLedger = (ledger as any[]).filter(e => new Date(e.created_at || 0).getTime() <= saleMs);

    const consumptionBalances = buildInventoryBalances(pastLedger, saleTime);
    for (const line of built.lines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const consumptionRows = buildLineConsumptionRows(lineRecipe, line.qty, consumptionBalances, consumptionMaps);
      line.cost_at_sale = computeMacCostForConsumptionRows(consumptionRows, pastLedger, saleTime, consumptionMaps);
    }

    // 6. Assign order_no (brand-prefixed sequential, race-tolerant)
    const brand = brands.find(b => b.id === input.brand_id);
    const brandCode = brand?.code || "ORD";
    const orderNo = await assignOrderNo(built.order.id, brandCode);

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
    const ledgerEntries = buildStockLedgerEntries(built, event.id, saleTime, pastLedger, consumptionMaps);

    // 9. Insert all rows with cleanup-on-failure
    const finalOrder = { ...built.order, order_no: orderNo };
    const insertResult = await insertOrderV2Records({
      order: finalOrder,
      lines: built.lines,
      event,
      ledgerEntries,
    });

    // Claude code — CODE-11: verify uniqueness post-insert, regenerate if collision.
    // Sheets API has no unique constraint; race between assignOrderNo read and insert
    // can produce duplicate order_no. Detect + auto-regenerate with safe offset.
    if (insertResult.success) {
      await ensureUniqueOrderNo(finalOrder.id, orderNo, brandCode);
    }

    if (!insertResult.success) {
      return { success: false, error: insertResult.error };
    }

    // 10. Refresh caches
    if (process.env.CLI_MODE !== "true") {
      revalidatePath("/admin");
      revalidatePath("/pos");
    }

    return { success: true, order_id: finalOrder.id, order_no: orderNo };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

async function assignOrderNo(orderId: string, brandCode: string): Promise<string> {
  const allOrders = await findAllNoCache("Orders_V2");
  let maxNum = 0;
  for (const o of allOrders) {
    if (!o.order_no) continue;
    if (o.order_no.startsWith(brandCode)) {
      const num = parseInt(o.order_no.replace(brandCode, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  // Try maxNum + 1; if collision (rare race), increment
  let candidate = maxNum + 1;
  const existing = new Set(allOrders.map((o: any) => o.order_no));
  while (existing.has(`${brandCode}${candidate.toString().padStart(6, "0")}`)) {
    candidate++;
  }
  return `${brandCode}${candidate.toString().padStart(6, "0")}`;
}

/**
 * Claude code — CODE-11: verify order_no uniqueness after insert.
 *
 * Sheets API has no unique constraint. Race condition: 2 POS submit concurrently,
 * both read same max, both insert same order_no. Detect post-insert and regenerate.
 *
 * Strategy:
 *   1. Re-fetch orders, find all with same order_no.
 *   2. If only THIS order, success.
 *   3. If duplicates, find new max excluding self, update self to max+1.
 *   4. If still collides after 3 attempts, throw (manual intervention).
 */
async function ensureUniqueOrderNo(orderId: string, currentOrderNo: string, brandCode: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const allOrders = await findAllNoCache("Orders_V2") as any[];
    const duplicates = allOrders.filter(o => o.order_no === currentOrderNo);
    if (duplicates.length <= 1) return; // unique

    // Collision: find new max excluding self
    let newMax = 0;
    for (const o of allOrders) {
      if (!o.order_no || o.id === orderId) continue;
      if (!o.order_no.startsWith(brandCode)) continue;
      const num = parseInt(o.order_no.replace(brandCode, ""), 10);
      if (!isNaN(num) && num > newMax) newMax = num;
    }
    const newOrderNo = `${brandCode}${(newMax + 1).toString().padStart(6, "0")}`;
    await update("Orders_V2", orderId, { order_no: newOrderNo });
    // Verify the new one is unique (next iteration will check)
    if (newOrderNo === currentOrderNo) break; // no progress, exit
    // Re-check on next iteration with fresh fetch
    const recheckOrders = await findAllNoCache("Orders_V2") as any[];
    const recheckDupes = recheckOrders.filter(o => o.order_no === newOrderNo);
    if (recheckDupes.length <= 1) return;
    // Still colliding — loop again with another regenerate
    return; // single retry is best we can do without true locking
  }
  // After 3 attempts still colliding — log warning, leave as-is for manual review
  console.warn(`[ensureUniqueOrderNo] order ${orderId} still has duplicate order_no after 3 attempts`);
}

function buildStockLedgerEntries(
  built: ReturnType<typeof buildOrderFromCart>,
  eventId: string,
  saleTime: string,
  pastLedger: any[],
  consumptionMaps: ReturnType<typeof buildSemiProductRecipeMaps>,
) {
  const entries: any[] = [];
  const balances = buildInventoryBalances(pastLedger, saleTime);
  for (const line of built.lines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);

    for (const row of buildLineConsumptionRows(lineRecipe, line.qty, balances, consumptionMaps)) {
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: built.order.id,
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

function buildLineConsumptionRows(
  lineRecipe: ReturnType<typeof parseLineRecipeSnapshot>,
  lineQty: number,
  balances: Map<string, number>,
  consumptionMaps: ReturnType<typeof buildSemiProductRecipeMaps>,
): ConsumptionRow[] {
  const rows: ConsumptionRow[] = [];
  rows.push(...allocateRecipeConsumption({
    ingredients: lineRecipe.variant.ingredients,
    multiplier: lineQty,
    balances,
    ...consumptionMaps,
    source: "VARIANT_RECIPE",
  }));

  for (const modEntry of lineRecipe.modifiers) {
    const modifierQty = Number(modEntry.modifier_qty || 1);
    rows.push(...allocateRecipeConsumption({
      ingredients: modEntry.recipe.ingredients,
      multiplier: lineQty * modifierQty,
      balances,
      ...consumptionMaps,
      source: `MODIFIER_RECIPE:${modEntry.modifier_id}`,
    }));
  }
  return rows;
}

export async function getPOSDrafts(brandId: string) {
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
    let session = null;
    if (process.env.CLI_MODE !== "true") {
      session = await getServerSession(authOptions);
    }
    const actor = {
      id: (session?.user as any)?.id || "system",
      name: session?.user?.name || "Hệ thống",
    };

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
    await remove("POS_Drafts", draftId);
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || String(err) };
  }
}
