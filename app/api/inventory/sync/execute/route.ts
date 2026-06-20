import { NextResponse } from "next/server";
import { findAll, findAllNoCache, insertMany, removeMany } from "@/lib/sheets_db";

function findRecipeAtTime(allRecipes: any[], targetType: string, targetId: string, atTime: string): any | null {
  const targetTime = new Date(atTime).getTime();
  const candidates = allRecipes.filter((r: any) => {
    if (r.target_type !== targetType || r.target_id !== targetId) return false;
    const effectiveTime = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (effectiveTime > targetTime) return false;
    if (r.end_date && r.end_date !== "") return new Date(r.end_date).getTime() > targetTime;
    return true;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a: any, b: any) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
  return candidates[0];
}

async function getIngredientUnitCost(allLedger: any[], ingredientId: string, beforeDate: string): Promise<number> {
  const purchases = allLedger.filter((s: any) =>
    s.item_reference === ingredientId &&
    s.transaction_type === "PO_RECEIPT" &&
    s.created_at &&
    new Date(s.created_at) <= new Date(beforeDate)
  );
  if (purchases.length === 0) return 0;
  purchases.sort((a: any, b: any) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
  return Number(purchases[0].unit_cost) || 0;
}

export async function POST(request: Request) {
  try {
    const { orderIds } = await request.json();
    if (!orderIds || !Array.isArray(orderIds)) return NextResponse.json({ error: "Invalid orderIds" }, { status: 400 });

    const [orders, orderLines, stockLedger, recipes, baseIngredients] = await Promise.all([
      findAllNoCache("Orders"),
      findAllNoCache("Order_Lines"),
      findAllNoCache("Stock_Ledger"),
      findAll("Recipes"),
      findAll("Base_Ingredients")
    ]);

    const stockLedgersToInsert: any[] = [];
    const stockLedgerIdsToRemove: string[] = [];

    for (const orderId of orderIds) {
      const order = orders.find((o: any) => o.id === orderId);
      if (!order) continue;

      const orderCreatedAt = order.created_at;
      const lines = orderLines.filter((l: any) => l.order_id === orderId);
      
      // Identify old stock entries to remove
      const oldStockIds = stockLedger.filter((s: any) => s.reference_id === orderId && s.transaction_type === "SALES_CONSUME").map((s: any) => s.id);
      stockLedgerIdsToRemove.push(...oldStockIds);

      // Create new Stock_Ledger entries
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const qty = Number(line.qty || 0);

        // Variant Recipe
        const variantRecipe = findRecipeAtTime(recipes, "PRODUCT_VARIANT", line.variant_id, orderCreatedAt);
        if (variantRecipe?.ingredients_json) {
          const ings = JSON.parse(variantRecipe.ingredients_json);
          for (const ing of ings) {
            const baseIng = baseIngredients.find((b: any) => b.id === ing.ingredient_id);
            if (baseIng?.is_non_inventory !== "TRUE" && baseIng?.is_non_inventory !== true && ing.quantity > 0) {
              const consumeQty = Number(ing.quantity) * qty;
              const unitCost = await getIngredientUnitCost(stockLedger, ing.ingredient_id, orderCreatedAt);
              stockLedgersToInsert.push({
                id: `STK-SYNC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                transaction_type: "SALES_CONSUME",
                reference_id: orderId,
                item_reference: ing.ingredient_id,
                quantity_change: -consumeQty,
                unit_cost: unitCost,
                created_at: orderCreatedAt,
              });
            }
          }
        }

        // Modifier Recipes
        try {
          const modifiers = JSON.parse(line.modifiers_json || "[]");
          for (const mod of modifiers) {
            const modRecipe = findRecipeAtTime(recipes, "MODIFIER", mod.id, orderCreatedAt);
            if (modRecipe?.ingredients_json) {
              const mIngs = JSON.parse(modRecipe.ingredients_json);
              for (const ing of mIngs) {
                const baseIng = baseIngredients.find((b: any) => b.id === ing.ingredient_id);
                if (baseIng?.is_non_inventory !== "TRUE" && baseIng?.is_non_inventory !== true && ing.quantity > 0) {
                  const consumeQty = Number(ing.quantity) * qty;
                  const unitCost = await getIngredientUnitCost(stockLedger, ing.ingredient_id, orderCreatedAt);
                  stockLedgersToInsert.push({
                    id: `STK-SYNC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                    transaction_type: "SALES_CONSUME",
                    reference_id: orderId,
                    item_reference: ing.ingredient_id,
                    quantity_change: -consumeQty,
                    unit_cost: unitCost,
                    created_at: orderCreatedAt,
                  });
                }
              }
            }
          }
        } catch (e) {}
      }
    }

    // Apply changes to Google Sheets
    if (stockLedgerIdsToRemove.length > 0) {
      await removeMany("Stock_Ledger", stockLedgerIdsToRemove);
    }
    if (stockLedgersToInsert.length > 0) {
      await insertMany("Stock_Ledger", stockLedgersToInsert);
    }

    return NextResponse.json({ success: true, updated: orderIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
