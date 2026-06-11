"use server";

import { findAll } from "@/lib/sheets_db";
import { computeLineRevenue } from "@/lib/report-utils";

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

  // 2. Tính MAC theo ngày (Moving Average Cost tại từng thời điểm)
  const nonInventoryIds = new Set(
    baseIngredients.filter((b: any) => b.is_non_inventory === "TRUE" || b.is_non_inventory === true).map((b: any) => b.id)
  );

  const receipts = stockLedger.filter((s: any) => s.transaction_type === "PO_RECEIPT");

  // Lấy tất cả unique dates từ completedOrders (để tính MAC cho từng ngày)
  const orderDates = Array.from(new Set(
    completedOrders.map((o: any) => {
      const d = new Date(o.created_at);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    })
  )).sort((a: any, b: any) => a - b);

  // macByDate[timestamp][ingredientId] = MAC tại cuối ngày đó
  const macByDate: Record<number, Record<string, number>> = {};

  // Tính MAC cho base ingredients tại mỗi ngày có đơn hàng
  const allIngredientIds = new Set(receipts.map((r: any) => r.item_reference));

  for (const dateTs of orderDates) {
    const dateEnd = dateTs + 24 * 60 * 60 * 1000 - 1; // end of day
    const macForDate: Record<string, number> = {};

    allIngredientIds.forEach((ingId: string) => {
      if (nonInventoryIds.has(ingId)) return; // Skip non-inventory
      let totalValue = 0;
      let totalQty = 0;
      receipts.forEach((r: any) => {
        if (r.item_reference !== ingId) return;
        const rTime = new Date(r.created_at).getTime();
        if (rTime > dateEnd) return;
        const qty = Number(r.quantity_change || 0);
        const cost = Number(r.unit_cost || 0);
        totalQty += qty;
        totalValue += qty * cost;
      });
      macForDate[ingId] = totalQty > 0 ? totalValue / totalQty : 0;
    });

    macByDate[dateTs] = macForDate;
  }

  // Helper: get MAC for an ingredient at a given order time
  const getMAC = (ingredientId: string, orderTime: string): number => {
    const orderTs = new Date(orderTime);
    const orderDateTs = new Date(orderTs.getFullYear(), orderTs.getMonth(), orderTs.getDate()).getTime();
    // Find the nearest date <= orderDateTs
    const sortedDates = orderDates.filter(d => d <= orderDateTs);
    if (sortedDates.length === 0) return 0;
    const nearestDate = sortedDates[sortedDates.length - 1];
    return macByDate[nearestDate]?.[ingredientId] || 0;
  };

  // Tính MAC cho Bán thành phẩm tại mỗi ngày
  const spRecipes = recipes.filter((r: any) => r.target_type === "SEMI_PRODUCT" && (!r.end_date || r.end_date === ""));

  semiProducts.forEach((sp: any) => {
    const recipe = spRecipes.find((r: any) => r.target_id === sp.id);
    if (!recipe || !recipe.ingredients_json) return;

    let ings: any[] = [];
    try { ings = JSON.parse(recipe.ingredients_json); } catch {}

    for (const dateTs of orderDates) {
      let totalCost = 0;
      for (const ing of ings) {
        const ingMac = macByDate[dateTs]?.[ing.ingredient_id] || 0;
        totalCost += ingMac * Number(ing.quantity || 0);
      }
      const yieldQty = Number(sp.batch_yield || 1);
      if (!macByDate[dateTs]) macByDate[dateTs] = {};
      macByDate[dateTs][sp.id] = yieldQty > 0 ? totalCost / yieldQty : 0;
    }
  });

  // Tìm công thức hoạt động tại một thời điểm xác định (có fallback về công thức cũ nhất nếu không tìm thấy)
  const findRecipeAtTime = (allRecipes: any[], targetType: string, targetId: string, atTime: string): any | null => {
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

    if (candidates.length > 0) {
      candidates.sort((a: any, b: any) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
      return candidates[0];
    }

    // Remove fallback to future recipe. If recipe wasn't created yet, COGS should be 0.
    return null;
  };

  const calculateRecipeCost = (recipe: any, orderTime: string) => {
    if (!recipe || !recipe.ingredients_json) return 0;
    let ings: any[] = [];
    try { ings = JSON.parse(recipe.ingredients_json); } catch {}
    let cost = 0;
    for (const ing of ings) {
      if (nonInventoryIds.has(ing.ingredient_id)) continue;
      cost += getMAC(ing.ingredient_id, orderTime) * Number(ing.quantity || 0);
    }
    return cost;
  };

  // 3. Tính Giá Vốn Hàng Bán (COGS) & Doanh Thu theo Order_Lines
  const validOrderIds = new Set(completedOrders.map((o:any) => o.id));
  
  let totalRevenue = 0;
  let totalCOGS = 0;
  
  const cogsByItem: Record<string, number> = {}; // Raw ingredient consumption
  const qtyByItem: Record<string, number> = {};

  // Hàm cộng dồn lượng nguyên vật liệu tiêu thụ từ công thức
  const addRecipeIngredientsToConsumption = (recipe: any, lineQty: number, orderTime: string) => {
    if (!recipe || !recipe.ingredients_json) return;
    let ings: any[] = [];
    try { ings = JSON.parse(recipe.ingredients_json); } catch {}
    for (const ing of ings) {
      if (nonInventoryIds.has(ing.ingredient_id)) continue;
      const itemId = ing.ingredient_id;
      const qtyConsumed = Number(ing.quantity || 0) * lineQty;
      const costPerUnit = getMAC(itemId, orderTime);
      const lineIngredientCOGS = qtyConsumed * costPerUnit;

      if (!cogsByItem[itemId]) {
        cogsByItem[itemId] = 0;
        qtyByItem[itemId] = 0;
      }
      cogsByItem[itemId] += lineIngredientCOGS;
      qtyByItem[itemId] += qtyConsumed;
    }
  };

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
    let mods: any[] = [];
    if (line.modifiers_json) {
      try {
        const parsedMods = JSON.parse(line.modifiers_json);
        if (Array.isArray(parsedMods)) mods = parsedMods;
      } catch (e) {}
    }

    const lineRevenue = computeLineRevenue({
      qty,
      unit_price: Number(line.unit_price || 0),
      line_discount: Number(line.line_discount || 0),
      modifiers_json: line.modifiers_json || "",
    });

    const variantRevenue = lineRevenue.variantRevenue;

    const order = completedOrders.find((o:any) => o.id === line.order_id);
    const orderTime = order ? order.created_at : new Date().toISOString();

    // Không dùng allocationRatio để giữ nguyên giá trị 15k/25k của sản phẩm
    // Doanh thu sẽ là variantRevenue = Math.max(0, lineRaw - lineDiscount)
    
    // Tìm công thức lịch sử của variant tại thời điểm tạo đơn hàng
    const histRecipe = findRecipeAtTime(recipes, "PRODUCT_VARIANT", line.variant_id, orderTime);
    const variantCogs = calculateRecipeCost(histRecipe, orderTime) * qty;

    // Cộng dồn nguyên liệu tiêu thụ cho variant
    addRecipeIngredientsToConsumption(histRecipe, qty, orderTime);

    productProfitMap[key].qty += qty;
    productProfitMap[key].revenue += variantRevenue;
    productProfitMap[key].cogs += variantCogs;

    totalCOGS += variantCogs;
    
    if (categoryId) {
      totalRevenue += variantRevenue;
    }

    // Tính doanh thu và cogs riêng cho từng topping (modifier)
    if (mods.length > 0) {
      mods.forEach((mod: any) => {
        const modKey = `modifier_${mod.id || mod.name}`;
        if (!productProfitMap[modKey]) {
          productProfitMap[modKey] = { name: mod.name, qty: 0, revenue: 0, cogs: 0 };
        }

        // Tìm công thức lịch sử của modifier tại thời điểm tạo đơn hàng
        const histModRecipe = findRecipeAtTime(recipes, "MODIFIER", mod.id, orderTime);
        const modCogs = calculateRecipeCost(histModRecipe, orderTime) * qty;

        // Cộng dồn nguyên liệu tiêu thụ cho modifier
        addRecipeIngredientsToConsumption(histModRecipe, qty, orderTime);

        const modRevenue = lineRevenue.modRevenues.find((m: any) => m.id === (mod.id || mod.name))?.revenue || 0;
        productProfitMap[modKey].qty += qty;
        productProfitMap[modKey].revenue += modRevenue;
        productProfitMap[modKey].cogs += modCogs;

        totalCOGS += modCogs;
        if (categoryId) {
          totalRevenue += modRevenue;
        }
      });
    }
  });

  // Tính totalRevenue theo Net Revenue từ từng món
  if (!categoryId) {
    totalRevenue = 0;
    Object.values(productProfitMap).forEach(p => totalRevenue += p.revenue);
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
        mac: orderDates.length > 0 ? (macByDate[orderDates[orderDates.length - 1]]?.[id] || 0) : 0,
        cogs: cogsByItem[id]
      };
    })
    .sort((a, b) => b.cogs - a.cogs); // Sắp xếp giảm dần theo giá vốn tiêu hao

  // 5. Định dạng dữ liệu Product & Topping Profit
  const productProfitAnalysis: any[] = [];
  const toppingProfitAnalysis: any[] = [];

  Object.entries(productProfitMap).forEach(([key, p]) => {
    if (p.qty <= 0) return;
    const gross = p.revenue - p.cogs;
    const margin = p.revenue > 0 ? (gross / p.revenue) * 100 : 0;
    const formattedItem = {
      ...p,
      grossProfit: gross,
      margin
    };

    if (key.startsWith("modifier_")) {
      toppingProfitAnalysis.push(formattedItem);
    } else {
      productProfitAnalysis.push(formattedItem);
    }
  });

  productProfitAnalysis.sort((a, b) => b.grossProfit - a.grossProfit);
  toppingProfitAnalysis.sort((a, b) => b.grossProfit - a.grossProfit);

  const grossProfit = totalRevenue - totalCOGS;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    margin,
    cogsDetails,
    productProfitAnalysis,
    toppingProfitAnalysis,
    orderCount: completedOrders.length
  };
}
