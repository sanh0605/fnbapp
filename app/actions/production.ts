"use server";

import { findAll, insert, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

export async function saveProductionOrder(formData: FormData) {
  const semi_product_id = formData.get("semi_product_id") as string;
  const target_yield = Number(formData.get("target_yield") || 0);
  const consumedIngredientsJson = formData.get("consumed_ingredients") as string;
  const user = formData.get("user") as string || "Admin";

  if (!semi_product_id || target_yield <= 0 || !consumedIngredientsJson) {
    return { error: "Dữ liệu không hợp lệ." };
  }

  try {
    const semiProducts = await findAll("Semi_Products");
    const targetSp = semiProducts.find(s => s.id === semi_product_id);
    if (!targetSp) return { error: "Không tìm thấy Bán Thành Phẩm." };
    
    let consumedIngredients = [];
    try {
      consumedIngredients = JSON.parse(consumedIngredientsJson);
    } catch (e) {
      return { error: "Dữ liệu nguyên liệu tiêu hao bị lỗi." };
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
    return { success: true, order_id };
  } catch (error: any) {
    return { error: error.message };
  }
}
