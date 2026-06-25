import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
process.env.CLI_MODE = "true";

const SHEETS_TO_DELETE = [
  "QUY TRÌNH TRIỂN KHAI",
  "TONG",
  "Thansg 3",
  "P&L",
  "CHUẨN BỊ TRƯỚC BÁN",
  "CCDC",
  "Trang tính2",
];

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSheetsClient } = await import("../lib/sheets_db");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  const sheetsClient = getSheetsClient();
  const meta = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const byTitle = new Map((meta.data.sheets || []).map(sheet => [sheet.properties?.title || "", sheet]));
  const requests: any[] = [];

  for (const title of SHEETS_TO_DELETE) {
    const sheet = byTitle.get(title);
    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
      console.log(`SKIP missing: ${title}`);
      continue;
    }
    requests.push({
      deleteSheet: {
        sheetId: sheet.properties.sheetId,
      },
    });
    console.log(`${apply ? "DELETE" : "DRY"} ${title}`);
  }

  if (!apply) {
    console.log(`\nNo data was written. Re-run with --apply to delete ${requests.length} sheets.`);
    return;
  }

  if (requests.length === 0) {
    console.log("\nNo sheets to delete.");
    return;
  }

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  console.log(`\nDeleted ${requests.length} sheets.`);
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
