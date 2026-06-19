/**
 * Backup V1 sheets before WS-5 live migration.
 *
 * Duplicates Orders, Order_Lines, Stock_Ledger tabs in place with
 * _BACKUP_PRE_WS5_<date> suffix. If backup tab already exists, skips.
 *
 * Run: npx tsx scripts/backup-v1-sheets.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { getSheetsClient } = require("../lib/sheets_db");

const SHEETS_TO_BACKUP = ["Orders", "Order_Lines", "Stock_Ledger"];

async function main() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID env var required");

  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const backupSuffix = `_BACKUP_PRE_WS5_${dateStr}`;

  console.log(`\n=== Backing up V1 sheets (suffix: ${backupSuffix}) ===\n`);

  // Get all existing sheets
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = meta.data.sheets || [];
  const existingTitles = new Set(existingSheets.map((s: any) => s.properties?.title));

  for (const sheetName of SHEETS_TO_BACKUP) {
    // Case-insensitive match — Google Sheets ranges are case-insensitive,
    // but sheet title metadata is exact case.
    const sourceSheet = existingSheets.find((s: any) =>
      (s.properties?.title || "").toLowerCase() === sheetName.toLowerCase(),
    );
    if (!sourceSheet) {
      console.log(`[SKIP] Source '${sheetName}' not found`);
      continue;
    }
    const actualSourceName = sourceSheet.properties.title; // preserve original case in messages

    const backupTitle = `${sheetName}${backupSuffix}`;
    if (existingTitles.has(backupTitle)) {
      console.log(`[EXISTS] '${backupTitle}' already exists, skipping`);
      continue;
    }

    const sourceSheetId = sourceSheet.properties?.sheetId;
    const newSheetIndex = existingSheets.length + 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          duplicateSheet: {
            sourceSheetId,
            insertSheetIndex: newSheetIndex,
            newSheetName: backupTitle,
          },
        }],
      },
    });

    console.log(`[CREATED] '${backupTitle}'`);
  }

  // Verify backups
  const metaAfter = await sheets.spreadsheets.get({ spreadsheetId });
  const backups = (metaAfter.data.sheets || [])
    .map((s: any) => s.properties?.title)
    .filter((t: string) => t?.includes(backupSuffix));

  console.log(`\n=== Backup complete ===`);
  console.log(`Backups created: ${backups.length}`);
  for (const b of backups) console.log(`  - ${b}`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
