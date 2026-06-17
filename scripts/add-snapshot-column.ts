/**
 * Phase 5: Schema Repair
 * Appends 'applied_promotion_snapshot_json' to the end of the Orders sheet headers.
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
  
  console.log(`[add-snapshot-column] mode=${IS_LIVE ? "LIVE" : "DRY-RUN"}`);
  
  const sheets = getSheetsClient();
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!1:1`,
  });
  
  const headers = res.data.values?.[0] || [];
  
  console.log("Current headers count:", headers.length);
  console.log("Last header:", headers[headers.length - 1]);
  
  if (headers.includes("applied_promotion_snapshot_json")) {
    console.log("Column 'applied_promotion_snapshot_json' already exists. No-op.");
    return;
  }
  
  const newColumnLetter = getColumnLetter(headers.length); // 0-indexed
  const targetRange = `Orders!${newColumnLetter}1:${newColumnLetter}1`;
  
  if (!IS_LIVE) {
    console.log(`DRY-RUN: would write 'applied_promotion_snapshot_json' to ${targetRange}`);
    return;
  }
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: targetRange,
    valueInputOption: "RAW",
    requestBody: { values: [["applied_promotion_snapshot_json"]] },
  });
  
  console.log(`LIVE: wrote header 'applied_promotion_snapshot_json' to ${targetRange}`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
