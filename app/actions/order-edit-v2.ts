"use server";

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "node:crypto";

import { buildEditedOrderFromCart } from "@/lib/order-edit-cart";
import { computeLineCostAtSale } from "@/lib/order-cogs";
import { supersedeOrderV2 } from "@/lib/sheets-db-v2-edit";
import { EVENT_TYPE, parseLineRecipeSnapshot } from "@/lib/order-types";
import type { CartInput } from "@/lib/order-cart";

export interface EditOrderV2Input {
  orderId: string;
  expectedVersion: number;
  cart: CartInput;
  reason: string;
}

export type EditOrderV2Result =
  | { success: true; new_order_id: string; new_version: number }
  | { success: false; error: string };

export async function editOrderV2(input: EditOrderV2Input): Promise<EditOrderV2Result> {
  try {
    if (!input.reason || input.reason.trim().length === 0) {
      return { success: false, error: "Lý do chỉnh sửa là bắt buộc" };
    }

    // 1. Load old order + lines
    const [allOrders, allLines] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
    ]);
    const oldOrder = allOrders.find((o: any) => o.id === input.orderId);
    if (!oldOrder) return { success: false, error: `Order ${input.orderId} not found` };

    const oldLines = allLines.filter((l: any) => l.order_id === input.orderId);
    const oldOrderV2 = normalizeOrderV2(oldOrder);
    const oldLinesV2 = oldLines.map(normalizeLineV2);

    // 2. Resolve actor
    const session = await getServerSession(authOptions);
    const actor = {
      id: (session?.user as any)?.id || "system",
      name: session?.user?.name || "Hệ thống",
    };

    // 3. Load reference data
    const [brands, products, variants, categories, modifiers, promotions, recipes, baseIngredients] = await Promise.all([
      findAll("Brands"), findAll("Products"), findAll("Product_Variants"),
      findAll("Product_Categories"), findAll("Modifiers"), findAll("Promotions"),
      findAll("Recipes"), findAll("Base_Ingredients"),
    ]);
    const ledger = await findAllNoCache("Stock_Ledger");

    // 4. Build edited order (preserves sale time, increments version)
    const built = buildEditedOrderFromCart(
      { ...input.cart, actor },
      { brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients },
      { order: oldOrderV2, lines: oldLinesV2 },
    );

    // 5. Compute COGS at ORIGINAL sale time (not edit time)
    const originalSaleTime = oldOrderV2.created_at;
    for (const line of built.lines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      line.cost_at_sale = computeLineCostAtSale(lineRecipe, ledger, line.qty, originalSaleTime);
    }

    // 6. Build EDITED event
    const eventTime = new Date().toISOString();
    const event = {
      id: `evt-${crypto.randomUUID()}`,
      order_id: built.order.id,
      event_type: EVENT_TYPE.EDITED,
      event_at: eventTime,
      actor_id: actor.id,
      actor_name: actor.name,
      from_version: oldOrderV2.version,
      to_version: built.order.version,
      previous_order_id: oldOrderV2.id,
      delta_json: JSON.stringify({
        old_gross: oldOrderV2.gross_total,
        new_gross: built.order.gross_total,
        old_net: oldOrderV2.net_total,
        new_net: built.order.net_total,
        old_line_count: oldLinesV2.length,
        new_line_count: built.lines.length,
      }),
      reason: input.reason,
    };

    // 7. Build reversal entries (mirror old SALES_CONSUME rows for this order)
    const oldLedgerRows = ledger.filter((l: any) =>
      l.reference_id === oldOrderV2.id && l.transaction_type === "SALES_CONSUME",
    );
    const reversalEntries = oldLedgerRows.map((l: any) => ({
      id: `stk-${crypto.randomUUID()}`,
      transaction_type: "EDIT_REVERSAL",
      reference_id: oldOrderV2.id,
      item_reference: l.item_reference,
      quantity_change: -Number(l.quantity_change), // negate (positive value)
      unit_cost: Number(l.unit_cost) || 0,
      created_at: eventTime,
      order_event_id: event.id,
      cost_at_sale: Number(l.cost_at_sale) || 0,
      source: l.source || "VARIANT_RECIPE",
    }));

    // 8. Build new SALES_CONSUME entries for the new version
    const consumeEntries = buildStockLedgerEntries(built, event.id, originalSaleTime);

    // 9. Execute supersede
    const result = await supersedeOrderV2({
      oldOrderId: oldOrderV2.id,
      expectedOldVersion: input.expectedVersion,
      newOrder: built.order,
      newLines: built.lines,
      event,
      reversalEntries,
      consumeEntries,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return {
      success: true,
      new_order_id: built.order.id,
      new_version: built.order.version,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

function buildStockLedgerEntries(
  built: ReturnType<typeof buildEditedOrderFromCart>,
  eventId: string,
  saleTime: string,
): any[] {
  const entries: any[] = [];
  for (const line of built.lines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    for (const ing of lineRecipe.variant.ingredients) {
      if (ing.quantity <= 0) continue;
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: built.order.id,
        item_reference: ing.ingredient_id,
        quantity_change: -(ing.quantity * line.qty),
        unit_cost: 0,
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: 0,
        source: "VARIANT_RECIPE",
      });
    }
    for (const modEntry of lineRecipe.modifiers) {
      for (const ing of modEntry.recipe.ingredients) {
        if (ing.quantity <= 0) continue;
        entries.push({
          id: `stk-${crypto.randomUUID()}`,
          transaction_type: "SALES_CONSUME",
          reference_id: built.order.id,
          item_reference: ing.ingredient_id,
          quantity_change: -(ing.quantity * line.qty),
          unit_cost: 0,
          created_at: saleTime,
          order_event_id: eventId,
          cost_at_sale: 0,
          source: `MODIFIER_RECIPE:${modEntry.modifier_id}`,
        });
      }
    }
  }
  return entries;
}

// Coerce raw sheet row (strings) into typed OrderV2/OrderLineV2 with numeric fields
function normalizeOrderV2(row: any): any {
  return {
    ...row,
    version: Number(row.version) || 1,
    gross_total: Number(row.gross_total) || 0,
    promo_discount_total: Number(row.promo_discount_total) || 0,
    manual_item_discount_total: Number(row.manual_item_discount_total) || 0,
    manual_order_discount: Number(row.manual_order_discount) || 0,
    net_total: Number(row.net_total) || 0,
  };
}

function normalizeLineV2(row: any): any {
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
  };
}
