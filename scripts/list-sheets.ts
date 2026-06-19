import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const { getSheetsClient } = require("../lib/sheets_db");

(async () => {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID });
  const titles = meta.data.sheets.map((s: any) => s.properties.title);
  console.log("All sheet titles:");
  for (const t of titles) console.log(`  - ${t}`);
})();
