// @ts-nocheck — legacy script using getSheetsClient bypass. Supabase migration Phase F will rewrite or delete.
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
process.env.CLI_MODE = "true";

const RESTORE = [
  "brands",
  "orders",
  "products",
  "purchased_items",
  "semi_products",
];

async function main() {
  const { getSheetsClient } = await import("../lib/sheets_db");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  const sheetsClient = getSheetsClient();
  const meta = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,hidden))",
  });
  const byTitle = new Map((meta.data.sheets || []).map(sheet => [sheet.properties?.title || "", sheet]));
  const requests: any[] = [];

  for (const title of RESTORE) {
    const archivedTitle = `ZZ_ARCHIVE_${title}`;
    const archived = byTitle.get(archivedTitle);
    if (!archived?.properties?.sheetId && archived?.properties?.sheetId !== 0) {
      console.log(`SKIP missing archived sheet: ${archivedTitle}`);
      continue;
    }
    if (byTitle.has(title)) {
      console.log(`SKIP target already exists: ${title}`);
      continue;
    }
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: archived.properties.sheetId,
          title,
          hidden: false,
        },
        fields: "title,hidden",
      },
    });
    console.log(`RESTORE ${archivedTitle} -> ${title}`);
  }

  if (requests.length === 0) {
    console.log("No sheets to restore.");
    return;
  }

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  console.log(`Restored ${requests.length} operational sheets.`);
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
