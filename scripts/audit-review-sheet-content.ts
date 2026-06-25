import * as dotenv from "dotenv";
import { resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
process.env.CLI_MODE = "true";

async function main() {
  const { getSheetsClient } = await import("../lib/sheets_db");
  const { classifySheets } = await import("../lib/sheet-usage-audit");
  const { summarizeSheetContent } = await import("../lib/sheet-content-audit");
  const usageReport = await import("../docs/audits/sheet-usage-report.json");

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  const sheetsClient = getSheetsClient();
  const usage = usageReport.default || usageReport;
  const reviewSheets = (usage.report || []).filter((row: any) => row.status === "REVIEW");
  const summaries = [];

  for (const sheet of reviewSheets) {
    const formulasRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: quoteRange(sheet.title),
      valueRenderOption: "FORMULA",
    });
    summaries.push(summarizeSheetContent(sheet.title, formulasRes.data.values || []));
  }

  summaries.sort((a, b) =>
    a.recommendation.localeCompare(b.recommendation) ||
    b.dataRows - a.dataRows ||
    a.title.localeCompare(b.title),
  );

  mkdirSync(resolve(process.cwd(), "docs", "audits"), { recursive: true });
  const jsonPath = resolve(process.cwd(), "docs", "audits", "review-sheet-content-report.json");
  const mdPath = resolve(process.cwd(), "docs", "audits", "review-sheet-content-report.md");

  writeFileSync(jsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    review_sheet_count: summaries.length,
    archive_recommended_count: summaries.filter(row => row.recommendation === "ARCHIVE_RECOMMENDED").length,
    keep_review_count: summaries.filter(row => row.recommendation === "KEEP_REVIEW").length,
    summaries,
  }, null, 2));

  writeFileSync(mdPath, renderMarkdown(summaries));

  console.log("=== REVIEW SHEET CONTENT AUDIT ===");
  console.log(`Review sheets:         ${summaries.length}`);
  console.log(`Archive recommended:   ${summaries.filter(row => row.recommendation === "ARCHIVE_RECOMMENDED").length}`);
  console.log(`Keep/manual review:    ${summaries.filter(row => row.recommendation === "KEEP_REVIEW").length}`);
  console.log("");
  console.log("Archive recommended:");
  for (const row of summaries.filter(row => row.recommendation === "ARCHIVE_RECOMMENDED")) {
    console.log(`- ${row.title}: ${row.reason}`);
  }
  console.log("");
  console.log(`Markdown: ${mdPath}`);
  console.log(`JSON:     ${jsonPath}`);
  console.log("No Google Sheets data was written.");
}

function quoteRange(title: string): string {
  return `'${title.replace(/'/g, "''")}'!A1:ZZ`;
}

function renderMarkdown(summaries: any[]): string {
  const lines = [
    "# Review Sheet Content Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Review sheets: ${summaries.length}`,
    `- Archive recommended: ${summaries.filter(row => row.recommendation === "ARCHIVE_RECOMMENDED").length}`,
    `- Keep/manual review: ${summaries.filter(row => row.recommendation === "KEEP_REVIEW").length}`,
    "",
    "## Sheets",
    "",
    "| Recommendation | Sheet | Rows | Data Rows | Formulas | Headers | Reason |",
    "| --- | --- | ---: | ---: | ---: | --- | --- |",
  ];

  for (const row of summaries) {
    lines.push([
      row.recommendation,
      escapeCell(row.title),
      row.nonEmptyRows,
      row.dataRows,
      row.formulaCells,
      escapeCell(row.headers.slice(0, 8).join(", ")),
      escapeCell(row.reason),
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  lines.push("");
  return lines.join("\n");
}

function escapeCell(value: string): string {
  return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
