"use server";

import { findAll, findAllNoCache, insert, update, remove } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import crypto from "node:crypto";

import { buildOrderFromCart } from "@/lib/order-cart";
import { EVENT_TYPE, ORDER_STATUS } from "@/lib/order-types";
import { parseLineRecipeSnapshot } from "@/lib/order-types";
import { computeMacCostFromUnitCosts } from "@/lib/mac-cogs";
import {
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
} from "@/lib/inventory-consumption";
import { getPosInventoryState } from "@/lib/pos-inventory-state";
import { savePosOrderAtomic } from "@/lib/pos-order-transaction";
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
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[]);

    // 4. Build order + lines + snapshots (pure function, internally asserts invariants)
    const built = buildOrderFromCart({ ...input, actor }, {
      brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients,
    });

    // 5. Load compact inventory state and compute COGS per line.
    const saleTime = built.order.created_at;
    const inventoryState = await getPosInventoryState(saleTime);
    const lineConsumptions: ConsumptionRow[][] = [];
    for (const line of built.lines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const consumptionRows = buildLineConsumptionRows(
        lineRecipe,
        line.qty,
        inventoryState.balances,
        consumptionMaps,
      );
      lineConsumptions.push(consumptionRows);
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

function buildStockLedgerEntries(
  orderId: string,
  eventId: string,
  saleTime: string,
  lineConsumptions: ConsumptionRow[][],
) {
  const entries: any[] = [];
  for (const consumptionRows of lineConsumptions) {
    for (const row of consumptionRows) {
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
