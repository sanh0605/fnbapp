/**
 * Backfill orders affected by E.1 calculateTotal bug:
 * total_amount was over-counted by sum of line_discount (promo portion).
 *
 * For each affected order:
 * - Recalculate total_amount = subtotal - orderDiscount - sum(line_discount)
 * - Log before/after for audit
 *
 * Usage: npx tsx scripts/backfill-e1-edit-bug.ts
 * Add --live flag to actually write; default is dry-run.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Use require to ensure lib/sheets_db.ts picks up the environment variables set by dotenv
const { findAllNoCache, update } = require("../lib/sheets_db");

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const LIVE = process.argv.includes("--live");

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID required");
  console.log(`Mode: ${LIVE ? "LIVE" : "DRY RUN"}`);
  console.log("");

  const orders = await findAllNoCache("Orders");
  const lines = await findAllNoCache("Order_Lines");

  const affected: any[] = [];

  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;
    const orderLines = lines.filter((l: any) => l.order_id === order.id);
    if (orderLines.length === 0) continue;

    const subtotal = Number(order.subtotal || order.subtotal_amount || 0);
    const orderDiscount = Number(order.discount_amount || 0);
    const sumLineDiscount = orderLines.reduce((s: number, l: any) => s + Number(l.line_discount || 0), 0);

    if (sumLineDiscount === 0) continue;

    const expectedTotal = Math.max(0, subtotal - orderDiscount - sumLineDiscount);
    const currentTotal = Number(order.total_amount || 0);

    // SAFEGUARD: Skip orders with total=0 (parked/corrupted, handle separately).
    // Also skip under-counted orders (currentTotal < expectedTotal) since those
    // may be legitimate old-proration values, not E.1 bug victims.
    // E.1 bug signature is OVER-counting (currentTotal > expectedTotal).
    if (currentTotal === 0) continue;
    if (currentTotal < expectedTotal) continue;

    if (Math.abs(currentTotal - expectedTotal) > 1) {
      affected.push({
        order_no: order.order_no,
        id: order.id,
        currentTotal,
        expectedTotal,
        diff: currentTotal - expectedTotal,
        subtotal,
        orderDiscount,
        sumLineDiscount,
      });
    }
  }

  console.log(`Found ${affected.length} affected orders:`);
  affected.forEach(a => {
    console.log(`  ${a.order_no}: ${a.currentTotal} → ${a.expectedTotal} (diff: ${a.diff})`);
    console.log(`    subtotal=${a.subtotal}, orderDisc=${a.orderDiscount}, sumLineDisc=${a.sumLineDiscount}`);
  });

  if (!LIVE) {
    console.log("");
    console.log("Dry run only. Add --live to apply fixes.");
    return;
  }

  // Apply fixes
  for (const a of affected) {
    await update("Orders", a.id, { total_amount: a.expectedTotal });
    console.log(`  ✓ Fixed ${a.order_no}`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
