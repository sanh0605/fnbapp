/**
 * Verify latest test order: read 3 newest orders + their Order_Lines.
 * Print full detail to confirm Phase A.2 fix + Phase B schema working.
 */
import { getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID required");
  const sheets = getSheetsClient();

  // Read latest 3 orders
  const resO = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:Q10000`,
  });
  const rowsO = resO.data.values || [];
  const headersO = rowsO[0] as string[];
  const dataRowsO = rowsO.slice(1);
  const latest3 = dataRowsO.slice(-3);

  console.log("=== LATEST 3 ORDERS ===");
  console.log("Headers:", headersO);
  console.log("");
  for (const row of latest3) {
    const obj: any = {};
    headersO.forEach((h, i) => { obj[h] = row[i] || ""; });
    console.log({
      order_no: obj.order_no,
      created_at: obj.created_at,
      total_amount: obj.total_amount,
      subtotal: obj.subtotal,
      discount_amount: obj.discount_amount,
      applied_promotion_id: obj.applied_promotion_id,
    });
  }

  // Get Order_Lines for the very latest order
  const latestOrder = latest3[latest3.length - 1];
  const latestOrderId = latestOrder[headersO.indexOf("id")];

  const resL = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:K10000`,
  });
  const rowsL = resL.data.values || [];
  const headersL = rowsL[0] as string[];
  const matchingLines = rowsL.slice(1).filter(r => r[headersL.indexOf("order_id")] === latestOrderId);

  console.log("");
  console.log(`=== ORDER_LINES for latest order (${latestOrderId}) ===`);
  console.log("Headers:", headersL);
  console.log("Matching lines count:", matchingLines.length);
  for (const line of matchingLines) {
    const obj: any = {};
    headersL.forEach((h, i) => { obj[h] = line[i] || ""; });
    console.log({
      id: obj.id,
      product_id: obj.product_id,
      variant_id: obj.variant_id,
      qty: obj.qty,
      unit_price: obj.unit_price,
      line_discount: obj.line_discount,
      line_manual_discount: obj.line_manual_discount,
    });
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
