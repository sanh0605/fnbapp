/**
 * Audit specific order + its lines + compute report math.
 */
import { getSheetsClient, findAllNoCache } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const TARGET_ORDER_NO = process.argv[2] || "PHD000522";

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID required");
  const sheets = getSheetsClient();

  // Read Orders
  const resO = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:Q10000`,
  });
  const rowsO = resO.data.values || [];
  const headersO = rowsO[0] as string[];
  const dataRowsO = rowsO.slice(1);

  const orderRow = dataRowsO.find(r => r[headersO.indexOf("order_no")] === TARGET_ORDER_NO);
  if (!orderRow) {
    console.log(`Order ${TARGET_ORDER_NO} not found`);
    return;
  }

  const order: any = {};
  headersO.forEach((h, i) => { order[h] = orderRow[i] || ""; });

  console.log(`=== ORDER ${TARGET_ORDER_NO} ===`);
  console.log(JSON.stringify(order, null, 2));

  // Read Order_Lines
  const resL = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:K10000`,
  });
  const rowsL = resL.data.values || [];
  const headersL = rowsL[0] as string[];
  const orderId = order.id;
  const matchingLines = rowsL.slice(1).filter(r => r[headersL.indexOf("order_id")] === orderId);

  console.log("");
  console.log(`=== ORDER_LINES (${matchingLines.length}) ===`);
  let totalLineDiscount = 0;
  let totalLineManualDiscount = 0;
  let computedGross = 0;
  for (const line of matchingLines) {
    const obj: any = {};
    headersL.forEach((h, i) => { obj[h] = line[i] || ""; });

    const qty = Number(obj.qty) || 0;
    const unitPrice = Number(obj.unit_price) || 0;
    let modifiers = 0;
    try {
      const mods = JSON.parse(obj.modifiers_json || "[]");
      modifiers = mods.reduce((sum: number, m: any) => sum + Number(m.price || 0), 0);
    } catch {}

    const lineGross = (unitPrice + modifiers) * qty;
    computedGross += lineGross;
    totalLineDiscount += Number(obj.line_discount) || 0;
    totalLineManualDiscount += Number(obj.line_manual_discount) || 0;

    console.log({
      id: obj.id,
      variant_id: obj.variant_id,
      qty,
      unit_price: unitPrice,
      modifiers_total: modifiers,
      line_gross: lineGross,
      line_discount: obj.line_discount,
      line_manual_discount: obj.line_manual_discount,
    });
  }

  console.log("");
  console.log("=== COMPUTED VALUES ===");
  console.log("Computed gross (sum of line_gross):", computedGross);
  console.log("Stored subtotal:", order.subtotal);
  console.log("Sum line_discount (promo):", totalLineDiscount);
  console.log("Sum line_manual_discount:", totalLineManualDiscount);
  console.log("Order discount_amount:", order.discount_amount);
  console.log("Total discount (line_discount + line_manual + order):", totalLineDiscount + totalLineManualDiscount + Number(order.discount_amount));
  console.log("Stored total_amount:", order.total_amount);
  console.log("");
  console.log("=== MATH CHECK ===");
  const expectedTotal = computedGross - totalLineDiscount - totalLineManualDiscount - Number(order.discount_amount);
  console.log(`Expected: ${computedGross} - ${totalLineDiscount} - ${totalLineManualDiscount} - ${order.discount_amount} = ${expectedTotal}`);
  console.log(`Actual total_amount: ${order.total_amount}`);
  console.log(`Match: ${expectedTotal === Number(order.total_amount) ? "YES" : "NO (MISMATCH)"}`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
