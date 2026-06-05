"use server";

import { findAll } from "@/lib/sheets_db";

export async function getPnLData(filters: any = {}) {
  const [orders, orderLines, products, variants, stockLedger, baseIngredients, semiProducts, units, recipes] = await Promise.all([
    findAll("Orders"),
    findAll("Order_Lines"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Stock_Ledger"),
    findAll("Base_Ingredients"),
    findAll("Semi_Products"),
    findAll("Units"),
    findAll("Recipes")
  ]);

  const { startDate, endDate, brandId, staffName, categoryId } = filters;
  
  // 1. Lọc Đơn Hàng (Orders)
  const completedOrders = orders.filter((o:any) => {
    if (o.status !== "COMPLETED") return false;
    if (!o.created_at) return false;
    
    if (startDate && endDate) {
      const d = new Date(o.created_at);
      if (d < new Date(startDate) || d > new Date(endDate)) return false;
    }
    
    if (brandId && o.brand_id !== brandId) return false;
    if (staffName && o.staff_name !== staffName) return false;
    
    return true;
  });

  // 2. Tính GIÁ BÌNH QUÂN (MAC - Moving Average Cost) cho từng Nguyên liệu gốc
  // MAC = Tổng giá trị nhập / Tổng số lượng nhập
  const macMap: Record<string, number> = {};
  const receipts = stockLedger.filter((s:any) => s.transaction_type === "PO_RECEIPT");
  
  const receiptGroups: any = {};
  receipts.forEach((r:any) => {
    if (!receiptGroups[r.item_reference]) {
      receiptGroups[r.item_reference] = { totalValue: 0, totalQty: 0 };
    }
    const qty = Number(r.quantity_change || 0);
    const cost = Number(r.unit_cost || 0);
    receiptGroups[r.item_reference].totalQty += qty;
    receiptGroups[r.item_reference].totalValue += (qty * cost);
  });

  baseIngredients.forEach((b:any) => {
    if (receiptGroups[b.id] && receiptGroups[b.id].totalQty > 0) {
      macMap[b.id] = receiptGroups[b.id].totalValue / receiptGroups[b.id].totalQty;
    } else {
      macMap[b.id] = 0; // Chưa có nhập hàng
    }
  });

  // Tính MAC cho Bán thành phẩm dựa trên Recipe
  const spRecipes = recipes.filter((r:any) => r.target_type === "SEMI_PRODUCT" && (!r.end_date || r.end_date === ""));
  
  semiProducts.forEach((sp:any) => {
    const recipe = spRecipes.find((r:any) => r.target_id === sp.id);
    if (recipe && recipe.ingredients_json) {
      let ings = [];
      try { ings = JSON.parse(recipe.ingredients_json); } catch(e){}
      
      let totalCost = 0;
      for (const ing of ings) {
        if (ing.ingredient_type === "BASE_INGREDIENT") {
           totalCost += (macMap[ing.ingredient_id] || 0) * Number(ing.quantity || 0);
        } else if (ing.ingredient_type === "SEMI_PRODUCT") {
           // Nếu có BTP lồng nhau, hiện tại hệ thống giả định BTP ko lồng quá sâu hoặc đã được tính
           totalCost += (macMap[ing.ingredient_id] || 0) * Number(ing.quantity || 0);
        }
      }
      const yieldQty = Number(sp.batch_yield || 1);
      macMap[sp.id] = yieldQty > 0 ? (totalCost / yieldQty) : 0;
    } else {
      macMap[sp.id] = 0;
    }
  });

  // Tính Unit COGS cho Product Variants & Modifiers
  const variantRecipes = recipes.filter((r:any) => r.target_type === "PRODUCT_VARIANT" && (!r.end_date || r.end_date === ""));
  const modifierRecipes = recipes.filter((r:any) => r.target_type === "MODIFIER" && (!r.end_date || r.end_date === ""));

  const calculateRecipeCost = (recipe: any) => {
    if (!recipe || !recipe.ingredients_json) return 0;
    let ings = [];
    try { ings = JSON.parse(recipe.ingredients_json); } catch(e){}
    let cost = 0;
    for (const ing of ings) {
      // Base Ingredient or Semi Product cost is in macMap
      cost += (macMap[ing.ingredient_id] || 0) * Number(ing.quantity || 0);
    }
    return cost;
  };

  const variantCOGS: Record<string, number> = {};
  variants.forEach((v:any) => {
    const r = variantRecipes.find((x:any) => x.target_id === v.id);
    variantCOGS[v.id] = calculateRecipeCost(r);
  });

  const modifierCOGS: Record<string, number> = {};
  // if we had a modifiers list, we would iterate it. Since we don't fetch Modifiers directly here, 
  // we just calculate it when we see it in orderLines, or build a map from modifierRecipes.
  modifierRecipes.forEach((r:any) => {
    modifierCOGS[r.target_id] = calculateRecipeCost(r);
  });

  // 3. Tính Giá Vốn Hàng Bán (COGS) & Doanh Thu theo Order_Lines
  const validOrderIds = new Set(completedOrders.map((o:any) => o.id));
  
  let totalRevenue = 0;
  let totalCOGS = 0;
  
  const cogsByItem: Record<string, number> = {}; // Raw ingredient consumption
  const qtyByItem: Record<string, number> = {};

  // Tính raw ingredient consumption từ SALES_CONSUME
  const consumes = stockLedger.filter((s:any) => 
    s.transaction_type === "SALES_CONSUME" && validOrderIds.has(s.reference_id)
  );

  consumes.forEach((c:any) => {
    const itemId = c.item_reference;
    const qtyConsumed = Math.abs(Number(c.quantity_change || 0));
    const costPerUnit = macMap[itemId] || 0;
    const lineCOGS = qtyConsumed * costPerUnit;

    if (!cogsByItem[itemId]) {
      cogsByItem[itemId] = 0;
      qtyByItem[itemId] = 0;
    }
    cogsByItem[itemId] += lineCOGS;
    qtyByItem[itemId] += qtyConsumed;
  });

  // Tính tổng doanh thu gốc (gồm món + toppings) cho từng đơn hàng để chia tỉ lệ chiết khấu
  const orderRawTotals: Record<string, number> = {};
  completedOrders.forEach((o: any) => {
    orderRawTotals[o.id] = 0;
  });

  orderLines.forEach((line: any) => {
    if (orderRawTotals[line.order_id] !== undefined) {
      const qty = Number(line.qty || 0);
      const price = Number(line.unit_price || 0);
      let lineRaw = qty * price;

      if (line.modifiers_json) {
        try {
          const modifiers = JSON.parse(line.modifiers_json);
          if (Array.isArray(modifiers)) {
            modifiers.forEach((mod: any) => {
              lineRaw += Number(mod.price || 0) * qty;
            });
          }
        } catch (e) {}
      }
      orderRawTotals[line.order_id] += lineRaw;
    }
  });

  const getOrderProratedRatio = (orderId: string, actualTotal: number) => {
    const rawTotal = orderRawTotals[orderId] || 0;
    if (rawTotal <= 0) return 0;
    return actualTotal / rawTotal;
  };

  // Tính Product Profit Analysis từ Order_Lines
  const productProfitMap: Record<string, { name: string, qty: number, revenue: number, cogs: number }> = {};

  orderLines.forEach((line:any) => {
    if (!validOrderIds.has(line.order_id)) return;

    const p = products.find((x:any) => x.id === line.product_id);
    if (categoryId && p?.category_id !== categoryId) return; // Lọc theo category

    const v = variants.find((x:any) => x.id === line.variant_id);
    const pName = p ? p.name : line.product_id;
    const vName = v ? v.name : '';
    const fullName = vName ? `${pName} (${vName})` : pName;

    const key = `${line.product_id}_${line.variant_id}`;
    
    if (!productProfitMap[key]) {
      productProfitMap[key] = { name: fullName, qty: 0, revenue: 0, cogs: 0 };
    }

    const qty = Number(line.qty || 0);
    const price = Number(line.unit_price || 0);
    
    const order = completedOrders.find((o:any) => o.id === line.order_id);
    const actualTotal = order ? Number(order.total_amount || 0) : 0;
    const ratio = getOrderProratedRatio(line.order_id, actualTotal);

    // Tính doanh thu và cogs riêng cho variant chính (không cộng topping)
    const variantRevenue = qty * price * ratio;
    const variantCogs = (variantCOGS[line.variant_id] || 0) * qty;

    productProfitMap[key].qty += qty;
    productProfitMap[key].revenue += variantRevenue;
    productProfitMap[key].cogs += variantCogs;

    totalCOGS += variantCogs;
    
    if (categoryId) {
      totalRevenue += variantRevenue;
    }

    // Tính doanh thu và cogs riêng cho từng topping (modifier)
    if (line.modifiers_json) {
      try {
        const mods = JSON.parse(line.modifiers_json);
        if (Array.isArray(mods)) {
          mods.forEach((mod: any) => {
            const modKey = `modifier_${mod.id || mod.name}`;
            if (!productProfitMap[modKey]) {
              productProfitMap[modKey] = { name: mod.name, qty: 0, revenue: 0, cogs: 0 };
            }
            const modRevenue = Number(mod.price || 0) * qty * ratio;
            const modCogs = (modifierCOGS[mod.id] || 0) * qty;

            productProfitMap[modKey].qty += qty;
            productProfitMap[modKey].revenue += modRevenue;
            productProfitMap[modKey].cogs += modCogs;

            totalCOGS += modCogs;
            if (categoryId) {
              totalRevenue += modRevenue;
            }
          });
        }
      } catch (e) {}
    }
  });

  // Tính totalRevenue theo Net Revenue (tổng tiền thu thực tế từ đơn hàng) nếu không lọc Category
  if (!categoryId) {
    totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.total_amount) || 0), 0);
  }

  // 4. Định dạng dữ liệu cho Báo cáo (Phân tích tỷ trọng Giá vốn)
  const cogsDetails = Object.keys(cogsByItem)
    .filter(id => cogsByItem[id] > 0)
    .map(id => {
      const b = baseIngredients.find((x:any) => x.id === id);
      const sp = semiProducts.find((x:any) => x.id === id);
      const item = b || sp;
      
      const name = item ? item.name : "Không xác định";
      const unitId = item ? item.base_unit : "";
      const unitName = units.find((u:any) => u.id === unitId)?.name || unitId;
      
      return {
        item_id: id,
        name,
        qty: qtyByItem[id],
        unitName,
        mac: macMap[id],
        cogs: cogsByItem[id]
      };
    })
    .sort((a, b) => b.cogs - a.cogs); // Sắp xếp giảm dần theo giá vốn tiêu hao

  // 5. Định dạng dữ liệu Product Profit
  const productProfitAnalysis = Object.values(productProfitMap)
    .filter(p => p.qty > 0)
    .map(p => {
      const gross = p.revenue - p.cogs;
      const margin = p.revenue > 0 ? (gross / p.revenue) * 100 : 0;
      return {
        ...p,
        grossProfit: gross,
        margin
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit); // Ưu tiên Lợi nhuận gộp cao nhất

  const grossProfit = totalRevenue - totalCOGS;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    margin,
    cogsDetails,
    productProfitAnalysis,
    orderCount: completedOrders.length
  };
}
