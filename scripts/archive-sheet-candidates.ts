import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
process.env.CLI_MODE = "true";

const ARCHIVE_PREFIX = "ZZ_ARCHIVE_";

const CANDIDATES = [
  "brands",
  "orders",
  "products",
  "purchased_items",
  "semi_products",
  "Order_Lines_BACKUP_PRE_WS5_2026-06-19",
  "Order_Lines-Backup-2026-06-17",
  "Order_Lines-Backup-PhaseE",
  "Orders_BACKUP_PRE_WS5_2026-06-19",
  "Orders-Backup-2026-06-17",
  "Orders-Backup-PhaseE",
  "Stock_Ledger_BACKUP_PRE_WS5_2026-06-19",
];

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSheetsClient } = await import("../lib/sheets_db");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  const sheetsClient = getSheetsClient();
  const meta = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,hidden))",
  });

  const sheets = meta.data.sheets || [];
  const byTitle = new Map(sheets.map(sheet => [sheet.properties?.title || "", sheet]));
  const requests: any[] = [];

  for (const title of CANDIDATES) {
    const sheet = byTitle.get(title);
    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
      console.log(`SKIP missing: ${title}`);
      continue;
    }

    const archivedTitle = `${ARCHIVE_PREFIX}${title}`;
    if (byTitle.has(archivedTitle)) {
      console.log(`SKIP already archived target exists: ${archivedTitle}`);
      continue;
    }

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: sheet.properties.sheetId,
          title: archivedTitle,
          hidden: true,
        },
        fields: "title,hidden",
      },
    });
    console.log(`${apply ? "ARCHIVE" : "DRY"} ${title} -> ${archivedTitle} (hidden)`);
  }

  if (!apply) {
    console.log(`\nNo data was written. Re-run with --apply to archive ${requests.length} sheets.`);
    return;
  }

  if (requests.length === 0) {
    console.log("\nNo sheets to archive.");
    return;
  }

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  console.log(`\nArchived and hid ${requests.length} sheets.`);
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
