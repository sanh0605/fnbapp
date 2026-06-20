import { NextResponse } from "next/server";
import { findAll, findAllNoCache } from "@/lib/sheets_db";

function findRecipeAtTime(allRecipes: any[], targetType: string, targetId: string, atTime: string): any | null {
  const targetTime = new Date(atTime).getTime();

  const candidates = allRecipes.filter((r: any) => {
    if (r.target_type !== targetType || r.target_id !== targetId) return false;
    const effectiveTime = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (effectiveTime > targetTime) return false;
    if (r.end_date && r.end_date !== "") {
      return new Date(r.end_date).getTime() > targetTime;
    }
    return true;
  });

  if (candidates.length === 0) return null;
  candidates.sort((a: any, b: any) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
  return candidates[0];
}

export async function GET() {
  try {
    const [orders, orderLines, stockLedger, recipes, baseIngredients, semiProducts] = await Promise.all([
      findAllNoCache("Orders"),
      findAllNoCache("Order_Lines"),
      findAllNoCache("Stock_Ledger"),
      findAll("Recipes"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products")
    ]);

    // Create a name map for UI friendliness
    const nameMap: Record<string, string> = {};
    baseIngredients.forEach((b: any) => nameMap[b.id] = b.name);
    semiProducts.forEach((s: any) => nameMap[s.id] = s.name);

    const completedOrders = orders.filter((o: any) => o.status === "COMPLETED" && o.voided !== "TRUE");
    const discrepancies: any[] = [];

    for (const order of completedOrders) {
      const lines = orderLines.filter((l: any) => l.order_id === order.id);
      const actualLedger = stockLedger.filter((s: any) => s.reference_id === order.id && s.transaction_type === "SALES_CONSUME");

      // Calculate expected consumption
      const expectedConsumption: Record<string, number> = {};
      for (const line of lines) {
        const qty = Number(line.qty || 0);
        
        // Product Variant Recipe
        const variantRecipe = findRecipeAtTime(recipes, "PRODUCT_VARIANT", line.variant_id, order.created_at);
        if (variantRecipe?.ingredients_json) {
          try {
            const ings = JSON.parse(variantRecipe.ingredients_json);
            ings.forEach((ing: any) => {
              if (ing.quantity > 0) {
                const baseIng = baseIngredients.find((b: any) => b.id === ing.ingredient_id);
                const sp = semiProducts.find((s: any) => s.id === ing.ingredient_id);
                const item = baseIng || sp;
                
                if (item?.is_non_inventory !== "TRUE" && item?.is_non_inventory !== true) {
                  expectedConsumption[ing.ingredient_id] = (expectedConsumption[ing.ingredient_id] || 0) + (Number(ing.quantity) * qty);
                }
              }
            });
          } catch (e) {}
        }

        // Modifier Recipes
        try {
          const modifiers = JSON.parse(line.modifiers_json || "[]");
          for (const mod of modifiers) {
            const modRecipe = findRecipeAtTime(recipes, "MODIFIER", mod.id, order.created_at);
            if (modRecipe?.ingredients_json) {
              const mIngs = JSON.parse(modRecipe.ingredients_json);
              mIngs.forEach((ing: any) => {
                if (ing.quantity > 0) {
                  const baseIng = baseIngredients.find((b: any) => b.id === ing.ingredient_id);
                  const sp = semiProducts.find((s: any) => s.id === ing.ingredient_id);
                  const item = baseIng || sp;

                  if (item?.is_non_inventory !== "TRUE" && item?.is_non_inventory !== true) {
                    expectedConsumption[ing.ingredient_id] = (expectedConsumption[ing.ingredient_id] || 0) + (Number(ing.quantity) * qty);
                  }
                }
              });
            }
          }
        } catch (e) {}
      }

      // Compare actual vs expected
      let hasMismatch = false;
      const actualSummary: Record<string, number> = {};
      actualLedger.forEach((s: any) => {
        actualSummary[s.item_reference] = (actualSummary[s.item_reference] || 0) + Math.abs(Number(s.quantity_change || 0));
      });

      const allIngIds = new Set([...Object.keys(expectedConsumption), ...Object.keys(actualSummary)]);
      const diffDetails: any[] = [];

      for (const ingId of allIngIds) {
        const expected = expectedConsumption[ingId] || 0;
        const actual = actualSummary[ingId] || 0;
        if (Math.abs(expected - actual) > 0.0001) {
          hasMismatch = true;
          diffDetails.push({
            id: ingId,
            name: nameMap[ingId] || ingId,
            expected,
            actual
          });
        }
      }

      if (hasMismatch) {
        discrepancies.push({
          order_id: order.id,
          order_no: order.order_no,
          created_at: order.created_at,
          diffs: diffDetails
        });
      }
    }

    return NextResponse.json({ discrepancies });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
