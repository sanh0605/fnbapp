"use server";

import { findAll, insert, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import type { DBProductionOrder, DBProductionItem, DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit, DBStockLedger } from "@/types/db";
import { requireAdmin } from "@/lib/auth";

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
    const activeSP = semiProducts.filter(sp => sp.status !== "DELETED");
    const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
    return { orders, productionItems, semiProducts: activeSP, recipes, baseIngredients, units };
  } catch (error) {
    console.error("Loi getProductionData:", error);
    return { orders: [], productionItems: [], semiProducts: [], recipes: [], baseIngredients: [], units: [] };
  }
}

export async function saveProductionOrder(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const semi_product_id = formData.get("semi_product_id") as string;
  const target_yield = Number(formData.get("target_yield") || 0);
  const consumedIngredientsJson = formData.get("consumed_ingredients") as string;
  const user = formData.get("user") as string || "Admin";

  if (!semi_product_id || target_yield <= 0 || !consumedIngredientsJson) {
    return fail("Dữ liệu không hợp lệ.");
  }

  try {
    const semiProducts = await findAll("Semi_Products");
    const targetSp = semiProducts.find((s:any) => s.id === semi_product_id);
    if (!targetSp) return fail("Không tìm thấy Bán Thành Phẩm.");
    
    let consumedIngredients = [];
    try {
      consumedIngredients = JSON.parse(consumedIngredientsJson);
    } catch (e) {
      return fail("Dữ liệu nguyên liệu tiêu hao bị lỗi.");
    }

    // Tạo lệnh nấu
    const order_id = await generateNewId("Production_Orders", "PRD");
    const applyDate = new Date().toISOString();
    
    await insert("Production_Orders", {
      id: order_id,
      apply_date: applyDate,
      created_at: applyDate
    });

    // Ghi nhận Item được tạo ra (Sản lượng thu được thực tế dựa trên Target Yield)
    const item_id = await generateNewId("Production_Items", "PRI");
    await insert("Production_Items", {
      id: item_id,
      production_order_id: order_id,
      semi_product_id: semi_product_id,
      qty_produced: target_yield,
      total_cost: 0 // Bỏ qua cost ở MVP
    });

    // Cập nhật Sổ Kho (Stock Ledger)
    // 1. Trừ kho Nguyên Liệu tiêu hao (Bỏ qua các nguyên liệu Non-inventory)
    for (const ing of consumedIngredients) {
      const qtyRequired = Number(ing.qtyNeeded);
      if (qtyRequired > 0 && !ing.is_non_inventory) {
         const ledger_id = await generateNewId("Stock_Ledger", "STK");
         await insert("Stock_Ledger", {
            id: ledger_id,
            transaction_type: "PRODUCTION_CONSUME",
            reference_id: order_id,
            item_reference: ing.ingredient_id,
            quantity_change: -qtyRequired, // Negative for consumption
            unit_cost: 0,
            created_at: applyDate
         });
      }
    }

    // 2. Cộng kho Bán Thành Phẩm thu được
    const yield_ledger_id = await generateNewId("Stock_Ledger", "STK");
    await insert("Stock_Ledger", {
        id: yield_ledger_id,
        transaction_type: "PRODUCTION_YIELD",
        reference_id: order_id,
        item_reference: semi_product_id,
        quantity_change: target_yield, // Positive for yield
        unit_cost: 0,
        created_at: applyDate
    });

    revalidatePath("/admin/production");
    return ok({ order_id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message);
  }
}
