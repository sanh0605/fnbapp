"use server";

import { findAll, insert, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function submitOrder(orderData: any) {
  try {
    const session = await getServerSession(authOptions);
    const staff_name = session?.user?.name || "Hệ thống";
    
    const { brand_id, items, total_amount, subtotal_amount, discount_amount, discount_type, payment_method } = orderData; // items = [{ product_id, variant_id, qty, unit_price, modifiers, discount_amount, discount_type }]
    if (!items || items.length === 0) return { error: "Giỏ hàng trống" };
    if (!brand_id) return { error: "Không xác định được thương hiệu. Vui lòng mở máy POS từ đầu." };

    // 1. Determine brand code
    const allBrands = await findAll("Brands");
    const brand = allBrands.find((b:any) => b.id === brand_id);
    const brandCode = brand?.code || "ORD";

    // 2. Generate unique order_id
    const nowIso = new Date().toISOString();
    const order_id = `ORD-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    // 2. Insert as PENDING first to reserve our row atomically
    await insert("Orders", {
      id: order_id,
      order_no: "PENDING",
      brand_id,
      total_amount,
      subtotal_amount: subtotal_amount || total_amount,
      discount_amount: discount_amount || 0,
      discount_type: discount_type || "VND",
      status: "COMPLETED",
      method: payment_method || "Tiền mặt",
      staff_name,
      created_at: nowIso
    });

    // 3. Fetch all orders again to find our exact row position
    const { findAllNoCache, update } = require('@/lib/sheets_db');
    const allOrdersAfter = await findAllNoCache("Orders");
    const myIndex = allOrdersAfter.findIndex((o:any) => o.id === order_id);
    
    let previousCount = 0;
    if (myIndex !== -1) {
      // Count how many orders with the same brand exist BEFORE our row
      for (let i = 0; i < myIndex; i++) {
        if (allOrdersAfter[i].brand_id === brand_id) {
          previousCount++;
        }
      }
    } else {
      // Fallback if not found (shouldn't happen)
      previousCount = allOrdersAfter.filter((o:any) => o.brand_id === brand_id).length;
    }

    let final_order_no = `${brandCode}${(previousCount + 1).toString().padStart(6, '0')}`;
    const existingOrderNos = allOrdersAfter.map((o: any) => o.order_no);
    while (existingOrderNos.includes(final_order_no)) {
      previousCount++;
      final_order_no = `${brandCode}${(previousCount + 1).toString().padStart(6, '0')}`;
    }

    // 4. Update the order with the true sequential number
    await update("Orders", order_id, { order_no: final_order_no });

    const allRecipes = await findAll("Recipes");
    const baseIngredients = await findAll("Base_Ingredients"); // To check is_non_inventory

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const line_id = `OL-${Date.now()}-${i}-${Math.floor(Math.random()*1000)}`;
      await insert("Order_Lines", {
        id: line_id,
        order_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        unit_price: item.unit_price,
        line_discount: item.discount_amount || 0,
        discount_type: item.discount_type || "VND",
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
                const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random()*1000)}`;
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
                    const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random()*1000)}`;
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
    
    return { success: true, order_no: final_order_no };
  } catch (error: any) {
    return { error: error.message };
  }
}
