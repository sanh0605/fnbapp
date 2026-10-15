"use server";

import { findAllNoCache } from "@/lib/db/tables";
import { requireAdmin } from "@/lib/auth/auth";
import { buildStockOnHand } from "@/lib/stock/stock-on-hand";

// BR-INV-019: read-only, same roles as Hàng hoá. Fresh reads (no cache) so a
// slip or purchase order changes the figures at once.
export async function getStockOnHand() {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [purchaseOrders, purchaseOrderLines, stockIssues, stocktakeSessions, stocktakeLines, items, categories, conversions, units] =
    await Promise.all(
      ["Purchase_Orders", "Purchase_Order_Lines", "Stock_Issues", "stocktake_sessions", "stocktake_lines", "Purchased_Items", "Item_Categories", "UOM_Conversions", "Units"]
        .map(findAllNoCache),
    );
  return buildStockOnHand({
    purchaseOrders, purchaseOrderLines, stockIssues, stocktakeSessions, stocktakeLines, items, categories, conversions, units,
    now: new Date(),
  });
}
