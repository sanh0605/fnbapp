"use server";

import { requireAdmin } from "@/lib/auth";
import { saveProductionOrderAtomic } from "@/lib/production-order-transaction";
import { fail, ok, type ActionResponse } from "@/lib/shared-actions";
import { findAll } from "@/lib/sheets_db";
import type {
  DBBaseIngredient,
  DBProductionItem,
  DBProductionOrder,
  DBRecipe,
  DBSemiProduct,
  DBUnit,
} from "@/types/db";
import { revalidatePath } from "next/cache";

const PATH = "/admin/production";

export async function getProductionData(): Promise<{
  orders: DBProductionOrder[];
  productionItems: DBProductionItem[];
  semiProducts: DBSemiProduct[];
  recipes: DBRecipe[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const [orders, productionItems, semiProducts, recipes, baseIngredients, allUnits] = await Promise.all([
      findAll("Production_Orders") as Promise<DBProductionOrder[]>,
      findAll("Production_Items") as Promise<DBProductionItem[]>,
      findAll("Semi_Products") as Promise<DBSemiProduct[]>,
      findAll("Recipes") as Promise<DBRecipe[]>,
      findAll("Base_Ingredients") as Promise<DBBaseIngredient[]>,
      findAll("Units") as Promise<DBUnit[]>,
    ]);
    const activeSP = semiProducts.filter((sp) => sp.status !== "DELETED");
    const units = allUnits.filter((unit) => unit.name && !unit.name.startsWith("DELETED_"));
    return { orders, productionItems, semiProducts: activeSP, recipes, baseIngredients, units };
  } catch (error) {
    console.error("Lỗi getProductionData:", error);
    return { orders: [], productionItems: [], semiProducts: [], recipes: [], baseIngredients: [], units: [] };
  }
}

type ConsumedIngredient = {
  ingredient_id?: unknown;
  ingredient_type?: unknown;
  unit_id?: unknown;
  qtyNeeded?: unknown;
  is_non_inventory?: unknown;
};

export async function saveProductionOrder(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const semiProductId = String(formData.get("semi_product_id") || "");
  const targetYield = Number(formData.get("target_yield") || 0);
  const consumedIngredientsJson = String(formData.get("consumed_ingredients") || "");
  if (!semiProductId || targetYield <= 0 || !consumedIngredientsJson) {
    return fail("Dữ liệu không hợp lệ.");
  }

  try {
    const semiProducts = await findAll("Semi_Products");
    if (!semiProducts.some((row: Record<string, unknown>) => row.id === semiProductId)) {
      return fail("Không tìm thấy Bán Thành Phẩm.");
    }

    let consumedIngredients: ConsumedIngredient[];
    try {
      const parsed: unknown = JSON.parse(consumedIngredientsJson);
      if (!Array.isArray(parsed)) throw new Error("Expected an array");
      consumedIngredients = parsed;
    } catch {
      return fail("Dữ liệu nguyên liệu tiêu hao bị lỗi.");
    }

    const inventoryItems = consumedIngredients.flatMap((ingredient) => {
      const quantity = Number(ingredient.qtyNeeded);
      if (!(quantity > 0) || ingredient.is_non_inventory) return [];
      if (
        typeof ingredient.ingredient_id !== "string" ||
        !ingredient.ingredient_id ||
        (ingredient.ingredient_type !== "BASE_INGREDIENT" &&
          ingredient.ingredient_type !== "SEMI_PRODUCT")
      ) {
        throw new Error("Dữ liệu nguyên liệu tiêu hao không hợp lệ.");
      }
      return [{
        ingredient_id: ingredient.ingredient_id,
        ingredient_type: ingredient.ingredient_type,
        quantity,
        unit_id: typeof ingredient.unit_id === "string" && ingredient.unit_id
          ? ingredient.unit_id
          : null,
      }];
    });

    const appliedAt = new Date().toISOString();
    const ledgerRows = inventoryItems.map((item) => ({
      transaction_type: "PRODUCTION_CONSUME",
      item_reference: item.ingredient_id,
      quantity_change: -item.quantity,
      unit_cost: 0,
      created_at: appliedAt,
    }));
    ledgerRows.push({
      transaction_type: "PRODUCTION_YIELD",
      item_reference: semiProductId,
      quantity_change: targetYield,
      unit_cost: 0,
      created_at: appliedAt,
    });

    const result = await saveProductionOrderAtomic({
      order: {
        semi_product_id: semiProductId,
        batch_yield: targetYield,
        status: "COMPLETED",
        created_by_id: auth.actor.id,
        created_by_name: auth.actor.name,
        created_at: appliedAt,
        completed_at: appliedAt,
      },
      items: inventoryItems,
      ledgerRows,
    });

    revalidatePath(PATH);
    return ok({ order_id: result.productionOrderId });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "Unknown error");
  }
}
