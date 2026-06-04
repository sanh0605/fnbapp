"use server";

import { findAll, findAllNoCache, insert, update, remove } from "@/lib/sheets_db";
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

    // 2. Delete old Order_Lines
    const allLines = await findAllNoCache("Order_Lines");
    const oldLines = allLines.filter((l: any) => l.order_id === orderId);
    for (const line of oldLines) {
      await remove("Order_Lines", line.id);
    }

    // 3. Delete old Stock_Ledger entries for this order
    const allStockLedger = await findAllNoCache("Stock_Ledger");
    const oldStockEntries = allStockLedger.filter((s: any) => s.reference_id === orderId);
    for (const entry of oldStockEntries) {
      await remove("Stock_Ledger", entry.id);
    }

    // 4. Create new Order_Lines and Stock_Ledger entries
    const allRecipes = await findAll("Recipes");
    const baseIngredients = await findAll("Base_Ingredients");

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const line_id = `OL-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      await insert("Order_Lines", {
        id: line_id,
        order_id: orderId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        unit_price: item.unit_price,
        line_discount: item.discount_amount || 0,
        discount_type: item.discount_type || "VND",
        modifiers_json: JSON.stringify(item.modifiers || []),
        created_at: nowIso,
      });

      // Stock deduction - variant recipe
      // Priority: recipe with end_date > orderCreatedAt
      // Fallback: recipe with empty end_date
      const variantRecipe = allRecipes.find((r: any) =>
        r.target_type === "PRODUCT_VARIANT" &&
        r.target_id === item.variant_id &&
        (
          (r.end_date && r.end_date !== "" && new Date(r.end_date) > new Date(orderCreatedAt)) ||
          (!r.end_date || r.end_date === "")
        )
      );

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
            const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await insert("Stock_Ledger", {
              id: ledger_id,
              transaction_type: "SALES_CONSUME",
              reference_id: orderId,
              item_reference: ing.ingredient_id,
              quantity_change: -consumeQty,
              unit_cost: 0,
              created_at: nowIso,
            });
          }
        }
      }

      // Stock deduction - modifier recipes
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modRecipe = allRecipes.find((r: any) =>
            r.target_type === "MODIFIER" &&
            r.target_id === mod.id &&
            (
              (r.end_date && r.end_date !== "" && new Date(r.end_date) > new Date(orderCreatedAt)) ||
              (!r.end_date || r.end_date === "")
            )
          );

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
                const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                await insert("Stock_Ledger", {
                  id: ledger_id,
                  transaction_type: "SALES_CONSUME",
                  reference_id: orderId,
                  item_reference: ing.ingredient_id,
                  quantity_change: -consumeQty,
                  unit_cost: 0,
                  created_at: nowIso,
                });
              }
            }
          }
        }
      }
    }

    // 5. Update the order record
    await update("Orders", orderId, {
      total_amount,
      subtotal_amount,
      discount_amount,
      discount_type,
      method: payment_method,
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/reports");

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
