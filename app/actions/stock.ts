"use server";

import { findAll, insert, update, generateNewId } from "@/lib/sheets_db";
import { revalidatePath, unstable_cache } from "next/cache";

export const getRealtimeStock = unstable_cache(
  async () => {
    const [stockLedger, baseIngredients, semiProducts, units] = await Promise.all([
      findAll("Stock_Ledger"),
      findAll("Base_Ingredients"),
      findAll("Semi_Products"),
      findAll("Units")
    ]);

    const stockMap: Record<string, number> = {};

    stockLedger.forEach((entry: any) => {
      const itemId = entry.item_reference;
      const qty = Number(entry.quantity_change || 0);
      if (!stockMap[itemId]) {
        stockMap[itemId] = 0;
      }
      stockMap[itemId] += qty;
    });

    const allItems = [
      ...baseIngredients.map((b: any) => ({ ...b, item_type: "BASE_INGREDIENT" })),
      ...semiProducts.map((s: any) => ({ ...s, item_type: "SEMI_PRODUCT" }))
    ];

    return allItems.map(item => {
      const unitName = units.find((u:any) => u.id === item.base_unit)?.name || item.base_unit;
      return {
        id: item.id,
        name: item.name,
        item_type: item.item_type,
        current_stock: stockMap[item.id] || 0,
        unitName
      };
    });
  },
  ["realtime-stock-all"],
  { revalidate: 60, tags: ["sheets-Stock_Ledger", "sheets-Base_Ingredients", "sheets-Semi_Products", "sheets-Units"] }
);

export async function submitStockAdjustment(data: any, role: string, username: string) {
  try {
    const nowIso = new Date().toISOString();
    const id = await generateNewId("Stock_Adjustments", "SADJ");
    
    // If admin submits, it's auto-approved
    const isApproved = role === "ADMIN";
    
    await insert("Stock_Adjustments", {
      id,
      item_reference: data.item_id,
      theoretical_qty: data.theoretical_qty,
      actual_qty: data.actual_qty,
      difference: data.difference,
      reason: data.reason || "",
      status: isApproved ? "APPROVED" : "PENDING",
      created_by: username,
      created_at: nowIso,
      approved_by: isApproved ? username : "",
      approved_at: isApproved ? nowIso : ""
    });

    if (isApproved) {
      // Create ledger entry immediately
      const ledger_id = await generateNewId("Stock_Ledger", "STK");
      await insert("Stock_Ledger", {
        id: ledger_id,
        transaction_type: "STOCK_ADJUST",
        reference_id: id,
        item_reference: data.item_id,
        quantity_change: data.difference,
        unit_cost: 0, // Adjustment doesn't change MAC directly, or it assumes current MAC
        created_at: nowIso
      });
    }

    revalidatePath("/admin/inventory/stock");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function approveStockAdjustment(adjustmentId: string, adminUsername: string) {
  try {
    const adjustments = await findAll("Stock_Adjustments");
    const adj = adjustments.find((a:any) => a.id === adjustmentId);
    if (!adj) return { error: "Không tìm thấy phiếu điều chỉnh" };
    if (adj.status === "APPROVED") return { error: "Phiếu đã được duyệt" };

    const nowIso = new Date().toISOString();
    
    await update("Stock_Adjustments", adjustmentId, {
      status: "APPROVED",
      approved_by: adminUsername,
      approved_at: nowIso
    });

    const ledger_id = await generateNewId("Stock_Ledger", "STK");
    await insert("Stock_Ledger", {
      id: ledger_id,
      transaction_type: "STOCK_ADJUST",
      reference_id: adjustmentId,
      item_reference: adj.item_reference,
      quantity_change: adj.difference,
      unit_cost: 0,
      created_at: nowIso
    });

    revalidatePath("/admin/inventory/stock");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
