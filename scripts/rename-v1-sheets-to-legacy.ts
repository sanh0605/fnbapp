/**
 * Rename V1 sheets to _LEGACY suffix.
 *
 * Idempotent: skips sheets already renamed. Preserves sheet IDs so
 * existing references still resolve.
 *
 * Run: npx tsx scripts/rename-v1-sheets-to-legacy.ts --live
 * (default is dry-run)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { getSheetsClient } = require("../lib/sheets_db");

const RENAMES: Array<{ from: string; to: string }> = [
  { from: "Orders", to: "Orders_LEGACY" },
  { from: "Order_Lines", to: "Order_Lines_LEGACY" },
  { from: "Stock_Ledger", to: "Stock_Ledger_LEGACY" },
];

async function main() {
  const isLive = process.argv.includes("--live");
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID env var required");

  console.log(`\n=== Rename V1 sheets to _LEGACY (${isLive ? "LIVE" : "DRY-RUN"}) ===\n`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(
    (meta.data.sheets || []).map((s: any) => s.properties?.title),
  );

  const requests: any[] = [];
  for (const { from, to } of RENAMES) {
    if (existingTitles.has(to)) {
      console.log(`[SKIP] '${to}' already exists`);
      continue;
    }
    // Case-insensitive search for source sheet
    const sourceSheet = (meta.data.sheets || []).find(
      (s: any) => (s.properties?.title || "").toLowerCase() === from.toLowerCase(),
    );
    if (!sourceSheet) {
      console.log(`[SKIP] Source '${from}' not found`);
      continue;
    }
    const sheetId = sourceSheet.properties?.sheetId;
    if (sheetId === undefined) {
      console.log(`[SKIP] '${from}' has no sheetId`);
      continue;
    }
    console.log(`[WILL RENAME] '${sourceSheet.properties.title}' → '${to}' (sheetId=${sheetId})`);
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, title: to },
        fields: "title",
      },
    });
  }

  if (requests.length === 0) {
    console.log("\nNothing to rename.");
    return;
  }

  if (!isLive) {
    console.log(`\nDry-run complete. ${requests.length} rename(s) pending. Use --live to apply.`);
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  console.log(`\nApplied ${requests.length} rename(s).`);

  // Verify
  const metaAfter = await sheets.spreadsheets.get({ spreadsheetId });
  const titlesAfter = (metaAfter.data.sheets || []).map((s: any) => s.properties?.title);
  for (const { to } of RENAMES) {
    if (titlesAfter.includes(to)) {
      console.log(`  ✓ '${to}' exists`);
    } else {
      console.log(`  ✗ '${to}' MISSING`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
