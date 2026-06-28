/**
 * Truncate Sheets Orders_V2 + Order_Lines_V2 (keep header row 1).
 *
 * Claude code — Phase E cleanup follow-up.
 *
 * Original Sheets data is redundant with Supabase after migration. Phase E
 * edge function appends duplicates if not truncated. This script:
 *   1. Reads current row count.
 *   2. Truncates data rows (keeps header).
 *   3. Resets sync_state cursor.
 *
 * Default: dry-run. --apply to execute.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

const SHEETS = [
  { name: "Orders_V2", titleLower: "orders_v2" },
  { name: "Order_Lines_V2", titleLower: "order_lines_v2" },
];

async function getSheetMeta(sheets: any, titleLower: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(
    (s: any) => (s.properties?.title || "").toLowerCase() === titleLower,
  );
  if (!sheet) throw new Error(`Sheet ${titleLower} not found`);
  return {
    sheetId: sheet.properties.sheetId,
    rowCount: sheet.properties.gridProperties?.rowCount || 0,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`=== TRUNCATE BACKUP SHEET (${apply ? "APPLY" : "DRY-RUN"}) ===\n`);

  const credentialsJson = Buffer.from(
    process.env.GOOGLE_CREDENTIALS_BASE64!,
    "base64",
  ).toString("utf-8");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentialsJson),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  for (const s of SHEETS) {
    const { sheetId, rowCount } = await getSheetMeta(sheets, s.titleLower);
    const dataRows = rowCount - 1; // exclude header
    console.log(`${s.name}: ${rowCount} total rows (${dataRows} data + 1 header)`);
    if (dataRows <= 0) {
      console.log(`  Already empty. Skipping.`);
      continue;
    }
    if (!apply) continue;
    // Google Sheets API can't delete all non-frozen rows in one request.
    // Use values.clear to wipe data instead. Empty rows remain but contain no data.
    const result = await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${s.name}!A2:ZZ${rowCount}`,
    });
    console.log(`  Cleared ${result.data.clearedRange}.`);
  }

  if (!apply) {
    console.log("\nNo data written. Re-run with --apply to truncate.");
    return;
  }

  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  const earlyDate = "2020-01-01T00:00:00.000Z";
  await supabase
    .from("sync_state")
    .upsert({ sync_key: "orders_v2", last_synced_at: earlyDate }, { onConflict: "sync_key" });
  console.log(`\nsync_state.orders_v2 reset to ${earlyDate}.`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
