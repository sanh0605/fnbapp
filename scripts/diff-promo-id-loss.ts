/**
 * Phase 5.5: Promo ID Drift Diff
 * Identifies orders that had an applied_promotion_id during Phase 2
 * but do not have it in the current live Orders sheet.
 */

import * as fs from "fs";
import * as path from "path";
import { findAllNoCache } from "../lib/sheets_db";

async function main() {
  console.log("[diff-promo-id-loss] Loading Phase 2 classification data...");
  const classPath = path.resolve(process.cwd(), "scripts", "output", "classification.json");
  if (!fs.existsSync(classPath)) {
    throw new Error("classification.json not found. Did Phase 2 run?");
  }
  
  const classData = JSON.parse(fs.readFileSync(classPath, "utf-8"));
  const phase2OrdersWithId = classData.orders.filter((o: any) => o.evidence.appliedPromotionIdPresent);
  
  console.log(`[diff-promo-id-loss] Found ${phase2OrdersWithId.length} orders with applied_promotion_id in Phase 2.`);
  
  console.log("[diff-promo-id-loss] Fetching current Orders sheet...");
  const liveOrders = await findAllNoCache("Orders");
  
  const driftList: any[] = [];
  
  for (const p2Order of phase2OrdersWithId) {
    const liveOrder = liveOrders.find((o: any) => o.id === p2Order.orderId);
    if (!liveOrder) {
      console.log(`WARNING: Order ${p2Order.orderNo} (${p2Order.orderId}) not found in live DB!`);
      continue;
    }
    
    const currentId = liveOrder.applied_promotion_id || "";
    const phase2Id = p2Order.evidence.appliedPromotionIdValue;
    
    if (currentId === "" && phase2Id !== "") {
      driftList.push({
        order_no: p2Order.orderNo,
        created_at: p2Order.createdAt,
        phase2_promo_id: phase2Id,
        current_promo_id: currentId,
        staff_name: liveOrder.staff_name || ""
      });
    }
  }
  
  const outPath = path.resolve(process.cwd(), "scripts", "output", "promo-id-drift.json");
  fs.writeFileSync(outPath, JSON.stringify(driftList, null, 2));
  
  console.log("");
  console.log("=== DRIFT REPORT ===");
  if (driftList.length === 0) {
    console.log("No drift found. All orders from Phase 2 still have their promo IDs.");
  } else {
    console.log(`Found ${driftList.length} orders that lost their promo ID:`);
    console.table(driftList);
  }
  console.log(`Wrote details to ${outPath}`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
