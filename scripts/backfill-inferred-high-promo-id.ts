/**
 * Sub-Task 4: Backfill applied_promotion_id for 12 INFERRED_HIGH
 */
import * as fs from "fs";
import * as path from "path";
import { findAllNoCache } from "../lib/sheets_db";
import { batchUpdateOrders } from "./batch-sheets-orders";

const IS_LIVE = process.argv.includes("--live");

async function main() {
  console.log(`[backfill-inferred-high-promo-id] mode=${IS_LIVE ? "LIVE" : "DRY-RUN"}`);

  const orders = await findAllNoCache("Orders");

  let classData: any = { orders: [] };
  try {
    const classPath = path.resolve(process.cwd(), "scripts", "output", "classification.json");
    if (fs.existsSync(classPath)) {
      classData = JSON.parse(fs.readFileSync(classPath, "utf8"));
    }
  } catch (e) {
    throw new Error("Could not parse classification.json.");
  }

  const updates: any[] = [];
  const samples: any[] = [];

  const inferredHighIds = new Set(
    classData.orders
      .filter((o: any) => o.tier === "INFERRED_HIGH")
      .map((o: any) => o.orderId)
  );

  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;
    if (inferredHighIds.has(order.id)) {
      // Find the matchedPromoId from classification
      const cls = classData.orders.find((o: any) => o.orderId === order.id);
      if (cls && cls.matchedPromoId) {
        updates.push({
          id: order.id,
          data: { applied_promotion_id: cls.matchedPromoId }
        });
        samples.push(order.order_no);
      }
    }
  }

  console.log(`Orders needing promo ID backfill (INFERRED_HIGH): ${updates.length}`);
  console.log("Order numbers:");
  console.log(samples.join(", "));

  if (IS_LIVE && updates.length > 0) {
    console.log(`Sending ${updates.length} updates...`);
    await batchUpdateOrders(updates);
    console.log("Updates complete.");
  } else if (!IS_LIVE) {
    console.log("Run with --live to execute.");
  }
}

main().catch(console.error);
