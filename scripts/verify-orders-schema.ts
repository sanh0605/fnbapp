import { getSheetsClient, findAllNoCache } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID env var is required");

  const sheets = getSheetsClient();
  
  // Fetch headers
  const resOrdersHeader = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!1:1`,
  });
  
  const headers = resOrdersHeader.data.values?.[0] || [];
  
  console.log("ORDERS SHEET HEADERS:", headers);
  console.log("Has 'applied_promotion_id' column:", headers.includes("applied_promotion_id") ? "yes" : "no");
  console.log("Has 'applied_promotion_snapshot_json' column:", headers.includes("applied_promotion_snapshot_json") ? "yes" : "no");
  console.log("");

  // Fetch data
  const resOrdersData = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A2:Z`,
  });
  const rows = resOrdersData.data.values || [];
  
  const idIdx = headers.indexOf("applied_promotion_id");
  const snapIdx = headers.indexOf("applied_promotion_snapshot_json");
  const createdIdx = headers.indexOf("created_at");

  const totalRows = rows.length;
  let withId = 0;
  let withSnap = 0;
  let bothEmpty = 0;
  let inDateRange = 0;

  const startDate = new Date("2026-05-01T00:00:00Z").getTime();
  const endDate = new Date("2026-06-15T23:59:59Z").getTime();

  for (const row of rows) {
    const hasId = idIdx >= 0 && row[idIdx] && String(row[idIdx]).trim() !== "";
    const hasSnap = snapIdx >= 0 && row[snapIdx] && String(row[snapIdx]).trim() !== "";

    if (hasId) withId++;
    if (hasSnap) withSnap++;
    if (!hasId && !hasSnap) bothEmpty++;

    if (createdIdx >= 0 && row[createdIdx]) {
      const d = new Date(String(row[createdIdx])).getTime();
      if (d >= startDate && d <= endDate) {
        inDateRange++;
      }
    }
  }

  console.log("ORDERS STATS:");
  console.log(`  Total rows: ${totalRows}`);
  console.log(`  With applied_promotion_id != '': ${withId}`);
  console.log(`  With applied_promotion_snapshot_json != '': ${withSnap}`);
  console.log(`  With both empty: ${bothEmpty}`);
  console.log(`  Created between 2026-05-01 and 2026-06-15: ${inDateRange}`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
