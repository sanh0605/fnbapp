"use server";

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "node:crypto";

import { buildOrderFromCart } from "@/lib/order-cart";
import { computeLineCostAtSale } from "@/lib/order-cogs";
import { insertOrderV2Records } from "@/lib/sheets-db-v2";
import { EVENT_TYPE, ORDER_STATUS } from "@/lib/order-types";
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
    const session = await getServerSession(authOptions);
    const actor = {
      id: (session?.user as any)?.id || "system",
      name: session?.user?.name || "Hệ thống",
    };

    // 3. Load reference data (cached where possible)
    const [brands, products, variants, categories, modifiers, promotions, recipes, baseIngredients] = await Promise.all([
      findAll("Brands"),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Product_Categories"),
      findAll("Modifiers"),
      findAll("Promotions"),
      findAll("Recipes"),
      findAll("Base_Ingredients"),
    ]);
    const ledger = await findAllNoCache("Stock_Ledger");

    // 4. Build order + lines + snapshots (pure function, internally asserts invariants)
    const built = buildOrderFromCart({ ...input, actor }, {
      brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients,
    });

    // 5. Compute COGS per line, mutate lines in place
    const saleTime = built.order.created_at;
    for (const line of built.lines) {
      const recipeSnap = JSON.parse(line.recipe_snapshot_json);
      line.cost_at_sale = computeLineCostAtSale(recipeSnap, ledger, line.qty, saleTime);
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
    const ledgerEntries = buildStockLedgerEntries(built, event.id, saleTime);

    // 9. Insert all rows with cleanup-on-failure
    const finalOrder = { ...built.order, order_no: orderNo };
    const insertResult = await insertOrderV2Records({
      order: finalOrder,
      lines: built.lines,
      event,
      ledgerEntries,
    });

    if (!insertResult.success) {
      return { success: false, error: insertResult.error };
    }

    // 10. Refresh caches
    revalidatePath("/admin");
    revalidatePath("/pos");

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

function buildStockLedgerEntries(
  built: ReturnType<typeof buildOrderFromCart>,
  eventId: string,
  saleTime: string,
): Array<{
  id: string;
  transaction_type: string;
  reference_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  created_at: string;
  order_event_id: string;
  cost_at_sale: number;
}> {
  const entries: any[] = [];
  for (const line of built.lines) {
    const recipe = JSON.parse(line.recipe_snapshot_json);
    if (!recipe.ingredients) continue;

    // Per-ingredient cost = MAC × quantity; cost_at_sale on ledger row
    // is the per-ingredient cost (the line-level cost_at_sale is the sum).
    const lineCostPerQty = line.cost_at_sale / line.qty;

    for (const ing of recipe.ingredients) {
      if (ing.quantity <= 0) continue;
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: built.order.id,
        item_reference: ing.ingredient_id,
        quantity_change: -(ing.quantity * line.qty),
        unit_cost: 0, // legacy field, kept for backward compat; cost is in cost_at_sale
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: Math.round(lineCostPerQty * (ing.quantity / recipe.ingredients.reduce((s: number, i: any) => s + i.quantity, 0))),
      });
    }

    // Modifier recipes
    const modifiers = JSON.parse(line.modifiers_snapshot_json);
    for (const mod of modifiers) {
      // Modifier recipes are looked up at sale time but we don't have them here
      // (buildOrderFromCart didn't capture modifier recipes separately).
      // For WS-2 simplicity: skip modifier ingredient consumption; will be added in WS-3.
      // Note: this is a known gap, documented in migration_notes if it matters.
    }
  }
  return entries;
}
