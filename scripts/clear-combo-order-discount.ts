/**
 * Sub-Task 3: Clear combo duplicate for 37 orders
 */
import * as fs from "fs";
import * as path from "path";
import { findAllNoCache } from "../lib/sheets_db";
import { batchUpdateOrders } from "./batch-sheets-orders";

const IS_LIVE = process.argv.includes("--live");

async function main() {
  console.log(`[clear-combo-order-discount] mode=${IS_LIVE ? "LIVE" : "DRY-RUN"}`);

  const orders = await findAllNoCache("Orders");
  const lines = await findAllNoCache("Order_Lines");

  const linesByOrderId = new Map<string, any[]>();
  for (const l of lines) {
    if (!linesByOrderId.has(l.order_id)) {
      linesByOrderId.set(l.order_id, []);
    }
    linesByOrderId.get(l.order_id)!.push(l);
  }

  // Load the list of combo orders from the audit output (or re-detect them based on old values)
  // Re-detect is safer: The combo bug produced orders where:
  // (Old sum(line_discount) === old order.discount_amount) AND both > 0 AND discount_reason !== "MANUAL_DISCOUNT" 
  // Wait, the checkout bug DID set discount_reason = "MANUAL_DISCOUNT" because userCustomDiscount was set.
  // Actually, we can just look for orders where the NEW sum(line_discount + line_manual_discount) 
  // equals the CURRENT order.discount_amount, because Sub-task 1 preserved the total line discount amount, just split it.

  const updates: any[] = [];
  const samples: any[] = [];

  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;

    const orderDiscountAmount = Number(order.discount_amount || 0);
    if (orderDiscountAmount <= 0) continue;

    const myLines = linesByOrderId.get(order.id) || [];
    const sumLineTotalDiscount = myLines.reduce((sum: number, l: any) => 
      sum + Number(l.line_discount || 0) + Number(l.line_manual_discount || 0)
    , 0);

    if (sumLineTotalDiscount > 0 && sumLineTotalDiscount === orderDiscountAmount) {
      // This is a combo phantom duplicate order. The line discounts already account for it.
      updates.push({
        id: order.id,
        data: { discount_amount: 0 }
      });
      samples.push(order.order_no);
    }
  }

  console.log(`Orders identified as combo duplicates to clear: ${updates.length}`);
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
