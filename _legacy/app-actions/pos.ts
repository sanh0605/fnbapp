"use server";

import { findAll, findAllNoCache, insert, generateNewId, remove, insertMany, removeMany } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

async function getIngredientUnitCost(ingredientId: string, beforeDate: string, ledgerCache: any[]): Promise<number> {
  const purchases = ledgerCache.filter((s: any) =>
    s.item_reference === ingredientId &&
    s.transaction_type === "PO_RECEIPT" &&
    s.created_at &&
    new Date(s.created_at) <= new Date(beforeDate)
  );
  if (purchases.length === 0) return 0;
  purchases.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return Number(purchases[0].unit_cost) || 0;
}

export async function submitOrder(orderData: any) {
  try {
    const session = await getServerSession(authOptions);
    const staff_name = session?.user?.name || "Hệ thống";
    
    const { brand_id, items, total_amount, subtotal_amount, discount_amount, discount_type, payment_method, applied_promotion_id, applied_promotion_snapshot_json, discount_reason } = orderData; // items = [{ product_id, variant_id, qty, unit_price, modifiers, discount_amount, discount_type }]
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
      subtotal: subtotal_amount || total_amount,
      discount_amount: discount_amount || 0,
      discount_type: discount_type || "VND",
      status: "COMPLETED",
      method: payment_method || "Tien mat",
      staff_name,
      created_at: nowIso,
      applied_promotion_id: applied_promotion_id || "",
      applied_promotion_snapshot_json: applied_promotion_snapshot_json || "",
      discount_reason: discount_reason === "MANUAL_DISCOUNT" ? `Chiết khấu thủ công bởi ${staff_name}` : (discount_reason || "")
    });

    // 3. Fetch all orders again to find our exact row position
    const { findAllNoCache, update } = require('@/lib/sheets_db');
    const allOrdersAfter = await findAllNoCache("Orders");
    const myIndex = allOrdersAfter.findIndex((o:any) => o.id === order_id);
    
    let maxNum = 0;
    for (const o of allOrdersAfter) {
      if (o.id === order_id) continue;
      
      if (!o.brand_id || o.brand_id === brand_id || o.brand_id === "") {
        let num = 0;
        if (o.order_no && o.order_no.startsWith('#')) {
          num = parseInt(o.order_no.replace('#', ''), 10);
        } else if (o.order_no && o.order_no.startsWith(brandCode)) {
          num = parseInt(o.order_no.replace(brandCode, ''), 10);
        }
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let final_order_no = `${brandCode}${(maxNum + 1).toString().padStart(6, '0')}`;
    const existingOrderNos = allOrdersAfter.map((o: any) => o.order_no);
    while (existingOrderNos.includes(final_order_no)) {
      maxNum++;
      final_order_no = `${brandCode}${(maxNum + 1).toString().padStart(6, '0')}`;
    }

    // 4. Update the order with the true sequential number
    await update("Orders", order_id, { order_no: final_order_no });

    const allRecipes = await findAll("Recipes");
    const baseIngredients = await findAll("Base_Ingredients");
    const existingLedger = await findAllNoCache("Stock_Ledger");

    // Track created data
    const orderLinesToInsert: any[] = [];
    const stockLedgersToInsert: any[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const line_id = `OL-${Date.now()}-${i}-${Math.floor(Math.random()*1000)}`;
        orderLinesToInsert.push({
          id: line_id,
          order_id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          qty: item.qty,
          unit_price: item.unit_price,
          line_discount: item.promo_discount || 0,
          line_manual_discount: item.discount_amount || 0,
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
            let skip = false;
            if (ing.ingredient_type === "BASE_INGREDIENT") {
              const baseIng = baseIngredients.find((b:any) => b.id === ing.ingredient_id);
              if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
            }

            if (!skip && ing.quantity > 0) {
              const consumeQty = Number(ing.quantity) * Number(item.qty);
              const unitCost = await getIngredientUnitCost(ing.ingredient_id, nowIso, existingLedger);
              const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random()*1000)}`;
              stockLedgersToInsert.push({
                id: ledger_id,
                transaction_type: "SALES_CONSUME",
                reference_id: order_id,
                item_reference: ing.ingredient_id,
                quantity_change: -consumeQty,
                unit_cost: unitCost,
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
                  const unitCost = await getIngredientUnitCost(ing.ingredient_id, nowIso, existingLedger);
                  const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                  stockLedgersToInsert.push({
                    id: ledger_id,
                    transaction_type: "SALES_CONSUME",
                    reference_id: order_id,
                    item_reference: ing.ingredient_id,
                    quantity_change: -consumeQty,
                    unit_cost: unitCost,
                    created_at: nowIso
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

    } catch (lineError: any) {
      // Cleanup: remove partial lines, stock entries, and the order itself
      try { await remove("Orders", order_id); } catch (e) {}
      if (orderLinesToInsert.length > 0) {
        try { await removeMany("Order_Lines", orderLinesToInsert.map(l => l.id)); } catch (e) {}
      }
      if (stockLedgersToInsert.length > 0) {
        try { await removeMany("Stock_Ledger", stockLedgersToInsert.map(l => l.id)); } catch (e) {}
      }
      return { error: `Lỗi tạo order lines: ${lineError.message}. Đã rollback toàn bộ.` };
    }

    // Force refresh the inventory overviews if needed
    revalidatePath("/admin");
    revalidatePath("/pos");
    
    return { success: true, order_no: final_order_no };
  } catch (error: any) {
    return { error: error.message };
  }
}
