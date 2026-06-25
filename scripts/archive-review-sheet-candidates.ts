import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
process.env.CLI_MODE = "true";

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSheetsClient } = await import("../lib/sheets_db");
  const contentReport = await import("../docs/audits/review-sheet-content-report.json");

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  const report = contentReport.default || contentReport;
  const candidates = (report.summaries || [])
    .filter((row: any) => row.recommendation === "ARCHIVE_RECOMMENDED")
    .map((row: any) => row.title);

  const sheetsClient = getSheetsClient();
  const meta = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,hidden))",
  });

  const byTitle = new Map((meta.data.sheets || []).map(sheet => [sheet.properties?.title || "", sheet]));
  const requests: any[] = [];

  for (const title of candidates) {
    const sheet = byTitle.get(title);
    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
      console.log(`SKIP missing: ${title}`);
      continue;
    }
    const archivedTitle = `ZZ_ARCHIVE_${title}`;
    if (byTitle.has(archivedTitle)) {
      console.log(`SKIP target exists: ${archivedTitle}`);
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
    console.log(`${apply ? "ARCHIVE" : "DRY"} ${title} -> ${archivedTitle}`);
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
  console.log(`\nArchived and hid ${requests.length} review sheets.`);
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
