"use server";

import { findAll, findAllNoCache, insert, update, remove, insertMany, removeMany } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

interface EditLineItem {
  product_id: string;
  variant_id: string;
  qty: number;
  unit_price: number;
  modifiers: any[];
  discount_amount: number;
  discount_type: string;
}

async function getIngredientUnitCost(ingredientId: string, beforeDate: string): Promise<number> {
  const allLedger = await findAllNoCache("Stock_Ledger");
  const purchases = allLedger.filter((s: any) =>
    s.item_reference === ingredientId &&
    s.transaction_type === "PO_RECEIPT" &&
    s.created_at &&
    new Date(s.created_at) <= new Date(beforeDate)
  );

  if (purchases.length === 0) return 0;

  purchases.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return Number(purchases[0].unit_cost) || 0;
}

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

export async function editOrder(
  orderId: string,
  editData: {
    items: EditLineItem[];
    total_amount: number;
    subtotal_amount: number;
    discount_amount: number;
    discount_type: string;
    payment_method: string;
  }
) {
  try {
    // 1. Verify order exists
    const allOrders = await findAllNoCache("Orders");
    const order = allOrders.find((o: any) => o.id === orderId);
    if (!order) return { error: "Khong tim thay don hang" };

    const orderCreatedAt = order.created_at;
    const { items, total_amount, subtotal_amount, discount_amount, discount_type, payment_method } = editData;
    if (!items || items.length === 0) return { error: "Gio hang trong" };

    const nowIso = new Date().toISOString();

    // 2. Identify old lines and stock entries for later cleanup
    const allLines = await findAllNoCache("Order_Lines");
    const oldLineIds = allLines.filter((l: any) => l.order_id === orderId).map((l: any) => l.id);

    const allStockLedger = await findAllNoCache("Stock_Ledger");
    const oldStockIds = allStockLedger.filter((s: any) => s.reference_id === orderId).map((s: any) => s.id);

    // 3. Create new Order_Lines and Stock_Ledger entries FIRST (before deleting old)
    const allRecipes = await findAll("Recipes");
    const baseIngredients = await findAll("Base_Ingredients");

    const orderLinesToInsert: any[] = [];
    const stockLedgersToInsert: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const line_id = `OL-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      orderLinesToInsert.push({
        id: line_id,
        order_id: orderId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        unit_price: item.unit_price,
        line_discount: item.discount_amount || 0,
        discount_type: item.discount_type || "VND",
        modifiers_json: JSON.stringify(item.modifiers || []),
        created_at: orderCreatedAt,
      });

      // Stock deduction - variant recipe (using recipe active at order creation time)
      const variantRecipe = findRecipeAtTime(allRecipes, "PRODUCT_VARIANT", item.variant_id, orderCreatedAt);

      if (variantRecipe && variantRecipe.ingredients_json) {
        let ings: any[] = [];
        try { ings = JSON.parse(variantRecipe.ingredients_json); } catch (e) {}

        for (const ing of ings) {
          let skip = false;
          if (ing.ingredient_type === "BASE_INGREDIENT") {
            const baseIng = baseIngredients.find((b: any) => b.id === ing.ingredient_id);
            if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
          }

          if (!skip && ing.quantity > 0) {
            const consumeQty = Number(ing.quantity) * Number(item.qty);
            const unitCost = await getIngredientUnitCost(ing.ingredient_id, orderCreatedAt);
            const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            stockLedgersToInsert.push({
              id: ledger_id,
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

      // Stock deduction - modifier recipes
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modRecipe = findRecipeAtTime(allRecipes, "MODIFIER", mod.id, orderCreatedAt);

          if (modRecipe && modRecipe.ingredients_json) {
            let modIngs: any[] = [];
            try { modIngs = JSON.parse(modRecipe.ingredients_json); } catch (e) {}

            for (const ing of modIngs) {
              let skip = false;
              if (ing.ingredient_type === "BASE_INGREDIENT") {
                const baseIng = baseIngredients.find((b: any) => b.id === ing.ingredient_id);
                if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
              }

              if (!skip && ing.quantity > 0) {
                const consumeQty = Number(ing.quantity) * Number(item.qty);
                const unitCost = await getIngredientUnitCost(ing.ingredient_id, orderCreatedAt);
                const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                stockLedgersToInsert.push({
                  id: ledger_id,
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
      }
    }

    if (orderLinesToInsert.length > 0) {
      await insertMany("Order_Lines", orderLinesToInsert);
    }
    if (stockLedgersToInsert.length > 0) {
      await insertMany("Stock_Ledger", stockLedgersToInsert);
    }

    // 5. Update the order record
    await update("Orders", orderId, {
      total_amount,
      subtotal_amount,
      discount_amount,
      discount_type: "VND", // Force VND since we calculate it on the frontend
      method: payment_method,
      applied_promotion_id: "", // Xóa khuyến mãi nếu có chỉnh sửa sau thanh toán
      discount_reason: "Chỉnh sửa sau khi thanh toán",
    });

    // 6. Delete old lines and stock entries
    const deleteErrors: string[] = [];

    if (oldLineIds.length > 0) {
      try {
        await removeMany("Order_Lines", oldLineIds);
      } catch (e: any) {
        const msg = `Failed to delete old Order_Lines: ${e.message}`;
        console.error("[editOrder]", msg);
        deleteErrors.push(msg);
      }
    }

    if (oldStockIds.length > 0) {
      try {
        await removeMany("Stock_Ledger", oldStockIds);
      } catch (e: any) {
        const msg = `Failed to delete old Stock_Ledgers: ${e.message}`;
        console.error("[editOrder]", msg);
        deleteErrors.push(msg);
      }
    }

    revalidatePath("/admin/orders");
    revalidatePath("/admin/reports");

    if (deleteErrors.length > 0) {
      return {
        success: true,
        warning: `${deleteErrors.length} old record(s) could not be deleted. Check server logs.`,
        delete_errors: deleteErrors,
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[editOrder] Fatal error:", error);
    return { error: error.message };
  }
}
