/**
 * Sub-Task 2: Backfill subtotal for orders where it's 0 or empty.
 */
import { findAllNoCache } from "../lib/sheets_db";
import { batchUpdateOrders } from "./batch-sheets-orders";

const IS_LIVE = process.argv.includes("--live");

async function main() {
  console.log(`[backfill-orders-subtotal] mode=${IS_LIVE ? "LIVE" : "DRY-RUN"}`);
  
  const orders = await findAllNoCache("Orders");
  const lines = await findAllNoCache("Order_Lines");

  const linesByOrderId = new Map<string, any[]>();
  for (const l of lines) {
    if (!linesByOrderId.has(l.order_id)) {
      linesByOrderId.set(l.order_id, []);
    }
    linesByOrderId.get(l.order_id)!.push(l);
  }

  const updates: any[] = [];
  const samples: any[] = [];

  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;
    
    // Check if subtotal is missing or 0
    const sub = order.subtotal || order.subtotal_amount;
    if (sub !== undefined && sub !== "" && Number(sub) > 0) continue;

    const myLines = linesByOrderId.get(order.id) || [];
    let computedSubtotal = 0;

    for (const l of myLines) {
      let modsPrice = 0;
      if (l.modifiers_json) {
        try {
          const parsed = JSON.parse(l.modifiers_json);
          if (Array.isArray(parsed)) {
            modsPrice = parsed.reduce((sum: number, mod: any) => sum + Number(mod.price || 0), 0);
          }
        } catch {}
      }
      computedSubtotal += (Number(l.unit_price) + modsPrice) * Number(l.qty);
    }

    if (computedSubtotal > 0) {
      updates.push({
        id: order.id,
        data: { subtotal: computedSubtotal }
      });

      if (samples.length < 5) {
        samples.push({
          order_no: order.order_no,
          old_subtotal: sub,
          new_subtotal: computedSubtotal
        });
      }
    }
  }

  console.log(`Orders needing backfill: ${updates.length}`);
  console.log("Sample updates:");
  console.table(samples);

  if (IS_LIVE && updates.length > 0) {
    console.log(`Sending ${updates.length} updates...`);
    await batchUpdateOrders(updates);
    console.log("Updates complete.");
  } else if (!IS_LIVE) {
    console.log("Run with --live to execute.");
  }
}

main().catch(console.error);
