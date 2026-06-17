/**
 * Phase B: Sub-Task 1
 * Appends 'line_manual_discount' to the end of the Order_Lines sheet headers.
 */

import { getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const IS_LIVE = process.argv.includes("--live");

function getColumnLetter(colIndex: number): string {
  let letter = "";
  while (colIndex >= 0) {
    letter = String.fromCharCode((colIndex % 26) + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
}

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID env var is required");
  
  console.log(`[add-line-manual-discount-column] mode=${IS_LIVE ? "LIVE" : "DRY-RUN"}`);
  
  const sheets = getSheetsClient();
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!1:1`,
  });
  
  const headers = res.data.values?.[0] || [];
  
  console.log("Current headers count:", headers.length);
  console.log("Last header:", headers[headers.length - 1]);
  
  if (headers.includes("line_manual_discount")) {
    console.log("Column 'line_manual_discount' already exists. No-op.");
    return;
  }
  
  const newColumnLetter = getColumnLetter(headers.length); // 0-indexed
  const targetRange = `Order_Lines!${newColumnLetter}1:${newColumnLetter}1`;
  
  if (!IS_LIVE) {
    console.log(`DRY-RUN: would write 'line_manual_discount' to ${targetRange}`);
    return;
  }
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: targetRange,
    valueInputOption: "RAW",
    requestBody: { values: [["line_manual_discount"]] },
  });
  
  console.log(`LIVE: wrote header 'line_manual_discount' to ${targetRange}`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
