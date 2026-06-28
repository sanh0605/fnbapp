/**
 * Cleanup Sheets polluted rows from Phase E edge function bug.
 *
 * Claude code — Supabase migration Phase E cleanup.
 *
 * Default: dry-run (prints plan, no writes).
 * --apply: deletes rows + resets sync_state cursor.
 *
 * Cleanup targets (verified via diagnose-backup-sheet.ts):
 *   Orders_V2: delete rows 1073-1338 (266 polluted rows incl duplicate header)
 *   Order_Lines_V2: delete rows 1523-1933 (411 polluted rows incl duplicate header)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

interface CleanupTarget {
  sheetName: string;
  sheetTitleLower: string; // for matching in sheets metadata
  startRow: number; // 1-indexed, inclusive
  endRow: number; // 1-indexed, inclusive
}

const TARGETS: CleanupTarget[] = [
  { sheetName: "Orders_V2", sheetTitleLower: "orders_v2", startRow: 1073, endRow: 1338 },
  { sheetName: "Order_Lines_V2", sheetTitleLower: "order_lines_v2", startRow: 1523, endRow: 1933 },
];

async function getSheetId(sheets: any, titleLower: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(
    (s: any) => (s.properties?.title || "").toLowerCase() === titleLower,
  );
  if (!sheet || sheet.properties?.sheetId === undefined) {
    throw new Error(`Sheet tab "${titleLower}" not found`);
  }
  return sheet.properties.sheetId;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`=== CLEANUP BACKUP SHEET (${apply ? "APPLY" : "DRY-RUN"}) ===\n`);

  const credentialsJson = Buffer.from(
    process.env.GOOGLE_CREDENTIALS_BASE64!,
    "base64",
  ).toString("utf-8");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentialsJson),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  for (const target of TARGETS) {
    const count = target.endRow - target.startRow + 1;
    console.log(`${target.sheetName}: delete rows ${target.startRow}-${target.endRow} (${count} rows)`);

    if (!apply) continue;

    const sheetId = await getSheetId(sheets, target.sheetTitleLower);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: target.startRow - 1, // API is 0-indexed
                endIndex: target.endRow, // exclusive
              },
            },
          },
        ],
      },
    });
    console.log(`  Deleted.`);
  }

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply to execute cleanup.");
    return;
  }

  // Reset sync_state cursor so edge function re-backups from scratch.
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  // Set cursor to early date → edge function backs up everything > that date.
  const earlyDate = "2020-01-01T00:00:00.000Z";
  const { error } = await supabase
    .from("sync_state")
    .upsert({ sync_key: "orders_v2", last_synced_at: earlyDate }, { onConflict: "sync_key" });
  if (error) {
    console.error(`sync_state reset failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`\nsync_state.orders_v2 reset to ${earlyDate}`);
  console.log("\nDone. Next edge function run will re-backup all orders with correct schema.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
