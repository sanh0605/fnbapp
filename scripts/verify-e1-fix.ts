/**
 * Verify E.1 fix readiness:
 * 1. Sheet has line_manual_discount column
 * 2. Sample order (PHD000522) has correct data structure post-E.3 migration
 * 3. applied_promotion_id is preserved (not cleared)
 *
 * This is a READ-ONLY verification. Safe to run anytime.
 *
 * The E.1 fix code (committed) will operate correctly on this data when admin
 * edits the order. End-to-end UI test still required to confirm deploy.
 */
import { getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const TARGET_ORDER_NO = process.argv[2] || "PHD000522";

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID required");
  const sheets = getSheetsClient();

  console.log(`=== E.1 Fix Readiness Check ===`);
  console.log(`Target order: ${TARGET_ORDER_NO}`);
  console.log("");

  // 1. Verify Order_Lines schema
  const resLH = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!1:1`,
  });
  const lineHeaders = resLH.data.values?.[0] || [];
  const hasLineManualDiscount = lineHeaders.includes("line_manual_discount");
  const hasLineDiscount = lineHeaders.includes("line_discount");

  console.log("Order_Lines schema:");
  console.log(`  line_discount column: ${hasLineDiscount ? "OK" : "MISSING"}`);
  console.log(`  line_manual_discount column: ${hasLineManualDiscount ? "OK" : "MISSING"}`);
  if (!hasLineDiscount || !hasLineManualDiscount) {
    console.log("  FAIL: Schema incomplete. Run Phase B migration first.");
    process.exit(1);
  }
  console.log("");

  // 2. Find target order
  const resO = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:R10000`,
  });
  const orderRows = resO.data.values || [];
  const orderHeaders = orderRows[0] as string[];
  const orderDataRows = orderRows.slice(1);
  const orderIdx = orderDataRows.findIndex(r => r[orderHeaders.indexOf("order_no")] === TARGET_ORDER_NO);

  if (orderIdx === -1) {
    console.log(`Order ${TARGET_ORDER_NO} not found.`);
    console.log("Available recent orders:");
    orderDataRows.slice(-5).forEach(r => {
      const obj: any = {};
      orderHeaders.forEach((h, i) => { obj[h] = r[i] || ""; });
      console.log(`  ${obj.order_no} - applied_promotion_id: ${obj.applied_promotion_id || "(empty)"}`);
    });
    process.exit(1);
  }

  const orderObj: any = {};
  orderHeaders.forEach((h, i) => { orderObj[h] = orderDataRows[orderIdx][i] || ""; });

  console.log("Order state:");
  console.log(`  order_no: ${orderObj.order_no}`);
  console.log(`  id: ${orderObj.id}`);
  console.log(`  total_amount: ${orderObj.total_amount}`);
  console.log(`  subtotal: ${orderObj.subtotal}`);
  console.log(`  discount_amount (order-level): ${orderObj.discount_amount}`);
  console.log(`  applied_promotion_id: ${orderObj.applied_promotion_id || "(EMPTY - issue if non-empty expected)"}`);
  console.log(`  applied_promotion_snapshot_json: ${orderObj.applied_promotion_snapshot_json ? "present" : "(empty)"}`);
  console.log("");

  // 3. Read Order_Lines for this order
  const orderId = orderObj.id;
  const resL = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:L10000`,
  });
  const lineRows = resL.data.values || [];
  const lineHeaderRow = lineRows[0] as string[];
  const matchingLines = lineRows.slice(1).filter(r => r[lineHeaderRow.indexOf("order_id")] === orderId);

  console.log(`Order_Lines for ${TARGET_ORDER_NO} (${matchingLines.length} lines):`);
  console.log("");

  let totalPromo = 0;
  let totalManual = 0;
  matchingLines.forEach((line, idx) => {
    const obj: any = {};
    lineHeaderRow.forEach((h, i) => { obj[h] = line[i] || ""; });
    const promoPortion = Number(obj.line_discount || 0);
    const manualPortion = Number(obj.line_manual_discount || 0);
    totalPromo += promoPortion;
    totalManual += manualPortion;

    console.log(`  Line ${idx + 1}: ${obj.qty}x ${obj.product_id}`);
    console.log(`    unit_price:        ${obj.unit_price}`);
    console.log(`    line_discount (promo):    ${promoPortion}  ${promoPortion > 0 ? "OK" : ""}`);
    console.log(`    line_manual_discount:     ${manualPortion}  ${manualPortion > 0 ? "OK" : ""}`);
  });

  console.log("");
  console.log("Summary:");
  console.log(`  Total promo portion (line_discount):    ${totalPromo}`);
  console.log(`  Total manual portion (line_manual):     ${totalManual}`);

  // 4. Verdict
  console.log("");
  console.log("=== Verdict ===");

  const hasPromoId = !!orderObj.applied_promotion_id;
  const hasPromoPortion = totalPromo > 0;

  if (hasPromoId && hasPromoPortion) {
    console.log("PASS: Order has applied_promotion_id + line_discount (promo portion).");
    console.log("      E.1 fix will correctly preserve these on admin edit.");
  } else if (!hasPromoId && hasPromoPortion) {
    console.log("WARN: line_discount has value but applied_promotion_id is empty.");
    console.log("      This may be a stale state from before E.3 migration.");
  } else if (hasPromoId && !hasPromoPortion) {
    console.log("WARN: applied_promotion_id set but line_discount = 0.");
    console.log("      Possible partial migration.");
  } else {
    console.log("INFO: No promo on this order. E.1 fix still applies (preserves empty state).");
  }

  console.log("");
  console.log("=== End-to-end test instructions ===");
  console.log("After deploy completes:");
  console.log(`1. Open admin Orders page`);
  console.log(`2. Find ${TARGET_ORDER_NO}`);
  console.log(`3. Click Edit, change qty or add manual discount, Save`);
  console.log(`4. Re-run this script: npx tsx scripts/verify-e1-fix.ts ${TARGET_ORDER_NO}`);
  console.log(`5. Verify line_discount and applied_promotion_id are PRESERVED`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
