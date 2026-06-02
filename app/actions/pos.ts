"use server";

import { findAll, insert, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function submitOrder(orderData: any) {
  try {
    const session = await getServerSession(authOptions);
    const staff_name = session?.user?.name || "Hệ thống";
    
    const { brand_id, items, total_amount, payment_method } = orderData; // items = [{ product_id, variant_id, qty, unit_price, modifiers: [{ id, name, price, group_name }] }]
    if (!items || items.length === 0) return { error: "Giỏ hàng trống" };
    if (!brand_id) return { error: "Không xác định được thương hiệu. Vui lòng mở máy POS từ đầu." };

    const allBrands = await findAll("Brands");
    const brand = allBrands.find((b:any) => b.id === brand_id);
    const brandCode = brand?.code || "ORD";

    const allOrders = await findAll("Orders");
    const brandOrders = allOrders.filter((o:any) => o.order_no && o.order_no.startsWith(brandCode));
    const nextNum = brandOrders.length + 1;
    const order_no = `${brandCode}${nextNum.toString().padStart(6, '0')}`;

    const nowIso = new Date().toISOString();
    const order_id = await generateNewId("Orders", "ORD");

    // Lưu Order
    await insert("Orders", {
      id: order_id,
      order_no,
      brand_id,
      total_amount,
      status: "COMPLETED",
      method: payment_method || "Tiền mặt",
      staff_name,
      created_at: nowIso
    });

    const allRecipes = await findAll("Recipes");
    const baseIngredients = await findAll("Base_Ingredients"); // To check is_non_inventory

    for (const item of items) {
      const line_id = await generateNewId("Order_Lines", "OL");
      await insert("Order_Lines", {
        id: line_id,
        order_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        unit_price: item.unit_price,
        modifiers_json: JSON.stringify(item.modifiers || []),
        created_at: nowIso
      });

      // -- TRỪ KHO TỰ ĐỘNG --

      // 1. Trừ kho theo công thức của Variant (Thành phẩm)
      const variantRecipe = allRecipes.find((r:any) => 
        r.target_type === "PRODUCT_VARIANT" && 
        r.target_id === item.variant_id && 
        (!r.end_date || r.end_date === "")
      );

      if (variantRecipe && variantRecipe.ingredients_json) {
        let ings = [];
        try { ings = JSON.parse(variantRecipe.ingredients_json); } catch(e){}
        
        for (const ing of ings) {
          // Kiểm tra is_non_inventory nếu là nguyên liệu gốc
          let skip = false;
          if (ing.ingredient_type === "BASE_INGREDIENT") {
            const baseIng = baseIngredients.find((b:any) => b.id === ing.ingredient_id);
            if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
          }

          if (!skip && ing.quantity > 0) {
            const consumeQty = Number(ing.quantity) * Number(item.qty);
            const ledger_id = await generateNewId("Stock_Ledger", "STK");
            await insert("Stock_Ledger", {
              id: ledger_id,
              transaction_type: "SALES_CONSUME",
              reference_id: order_id,
              item_reference: ing.ingredient_id,
              quantity_change: -consumeQty,
              unit_cost: 0,
              created_at: nowIso
            });
          }
        }
      }

      // 2. Trừ kho theo công thức của các Modifiers (Toppings)
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modRecipe = allRecipes.find((r:any) => 
            r.target_type === "MODIFIER" && 
            r.target_id === mod.id && 
            (!r.end_date || r.end_date === "")
          );

          if (modRecipe && modRecipe.ingredients_json) {
            let modIngs = [];
            try { modIngs = JSON.parse(modRecipe.ingredients_json); } catch(e){}
            
            for (const ing of modIngs) {
              let skip = false;
              if (ing.ingredient_type === "BASE_INGREDIENT") {
                const baseIng = baseIngredients.find((b:any) => b.id === ing.ingredient_id);
                if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
              }

              if (!skip && ing.quantity > 0) {
                const consumeQty = Number(ing.quantity) * Number(item.qty);
                const ledger_id = await generateNewId("Stock_Ledger", "STK");
                await insert("Stock_Ledger", {
                  id: ledger_id,
                  transaction_type: "SALES_CONSUME",
                  reference_id: order_id,
                  item_reference: ing.ingredient_id,
                  quantity_change: -consumeQty,
                  unit_cost: 0,
                  created_at: nowIso
                });
              }
            }
          }
        }
      }
    }

    // Force refresh the inventory overviews if needed
    revalidatePath("/admin");
    revalidatePath("/pos");
    
    return { success: true, order_no };
  } catch (error: any) {
    return { error: error.message };
  }
}
