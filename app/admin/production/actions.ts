"use server";

import { requireAdmin } from "@/lib/auth";
import { fail, type ActionResponse } from "@/lib/shared-actions";
import { findAll } from "@/lib/sheets_db";
import type {
  DBBaseIngredient,
  DBProductionItem,
  DBProductionOrder,
  DBRecipe,
  DBSemiProduct,
  DBUnit,
} from "@/types/db";

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

// Owner decision 2026-08-05, BR-INV-006 (docs/BUSINESS-RULES.md, replaces
// BR-INV-003): semi-product stock tracking is dropped, not merely this
// screen. Measured the same day: 16 active semi-products hold 3.919
// stock_ledger rows and every one is a type Plan C Task 5 deletes -- none a
// purchase receipt, because a semi-product is never bought. Recording a
// batch here would book an asset whose ingredients were already expensed
// the moment they left stock -- the same money counted twice. Refuses
// outright: no production_orders row, no production_items, no ledger row.
// save_production_order_atomic (0018_atomic_production_order.sql) also
// hard-requires p_ledger to carry exactly items.length + 1 rows, so this
// could not be quietly reduced to "record the batch, skip the ledger"
// without a migration this plan does not add.
export async function saveProductionOrder(_formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  return fail(
    "Sổ kho giờ chỉ ghi nhận hàng nhập và kết quả kiểm kê định kỳ — không còn ghi nhận lệnh sản xuất bán thành phẩm.",
  );
}
