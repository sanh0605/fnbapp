import * as dotenv from "dotenv";
import { resolve, relative } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
process.env.CLI_MODE = "true";

async function main() {
  const { getSheetsClient } = await import("../lib/sheets_db");
  const { classifySheets, extractSheetReferences } = await import("../lib/sheet-usage-audit");

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  const sheetsClient = getSheetsClient();
  const meta = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title,gridProperties(rowCount,columnCount)))",
  });

  const sheets = (meta.data.sheets || []).map((sheet: any) => ({
    title: sheet.properties?.title || "",
    rowCount: sheet.properties?.gridProperties?.rowCount || 0,
    columnCount: sheet.properties?.gridProperties?.columnCount || 0,
  })).filter((sheet: any) => sheet.title);

  const files = listSourceFiles();
  const references = files.flatMap(file => {
    const source = readFileSync(file, "utf8");
    return extractSheetReferences(relative(process.cwd(), file), source);
  });

  const report = classifySheets({ sheets, references });
  mkdirSync(resolve(process.cwd(), "docs", "audits"), { recursive: true });
  const jsonPath = resolve(process.cwd(), "docs", "audits", "sheet-usage-report.json");
  const mdPath = resolve(process.cwd(), "docs", "audits", "sheet-cleanup-plan.md");

  writeFileSync(jsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    sheet_count: sheets.length,
    reference_count: references.length,
    report,
  }, null, 2));

  writeFileSync(mdPath, renderMarkdown(report, references));

  printSummary(report, mdPath, jsonPath);
}

function listSourceFiles(): string[] {
  const output = execFileSync("rg", [
    "--files",
    "app",
    "lib",
    "scripts",
    "components",
    "-g",
    "*.ts",
    "-g",
    "*.tsx",
    "-g",
    "*.js",
  ], { cwd: process.cwd(), encoding: "utf8" });
  return output.split(/\r?\n/).filter(Boolean).map(file => resolve(process.cwd(), file));
}

function renderMarkdown(report: ReturnType<typeof import("../lib/sheet-usage-audit").classifySheets>, references: any[]): string {
  const lines: string[] = [];
  lines.push("# Google Sheets Cleanup Plan");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- KEEP: ${report.filter(row => row.status === "KEEP").length}`);
  lines.push(`- REVIEW: ${report.filter(row => row.status === "REVIEW").length}`);
  lines.push(`- ARCHIVE_CANDIDATE: ${report.filter(row => row.status === "ARCHIVE_CANDIDATE").length}`);
  lines.push(`- Code references found: ${references.length}`);
  lines.push("");
  lines.push("## Recommended Process");
  lines.push("");
  lines.push("1. Keep all `KEEP` sheets unchanged.");
  lines.push("2. Manually inspect `REVIEW` sheets for formulas, pivots, dashboards, and external integrations.");
  lines.push("3. Rename `ARCHIVE_CANDIDATE` sheets to `ZZ_ARCHIVE_<old_name>` first; do not delete immediately.");
  lines.push("4. Run order ledger, COGS, purchase ledger, and current stock audits after renaming.");
  lines.push("5. Delete archived sheets only after a verified backup and one successful operating cycle.");
  lines.push("");
  lines.push("## Sheets");
  lines.push("");
  lines.push("| Status | Sheet | Size | Reason | References |");
  lines.push("| --- | --- | ---: | --- | --- |");
  for (const row of report) {
    const refs = row.references.slice(0, 5).map(ref => `${ref.filePath}:${ref.line}`).join("<br>");
    const more = row.references.length > 5 ? `<br>+${row.references.length - 5} more` : "";
    lines.push(`| ${row.status} | ${escapeCell(row.title)} | ${row.rowCount}x${row.columnCount} | ${escapeCell(row.reason)} | ${refs}${more} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function printSummary(report: ReturnType<typeof import("../lib/sheet-usage-audit").classifySheets>, mdPath: string, jsonPath: string): void {
  console.log("=== SHEET USAGE AUDIT ===");
  console.log(`KEEP:              ${report.filter(row => row.status === "KEEP").length}`);
  console.log(`REVIEW:            ${report.filter(row => row.status === "REVIEW").length}`);
  console.log(`ARCHIVE_CANDIDATE: ${report.filter(row => row.status === "ARCHIVE_CANDIDATE").length}`);
  console.log("");
  console.log("Top archive candidates:");
  for (const row of report.filter(row => row.status === "ARCHIVE_CANDIDATE").slice(0, 20)) {
    console.log(`- ${row.title}: ${row.reason}`);
  }
  console.log("");
  console.log(`Markdown: ${mdPath}`);
  console.log(`JSON:     ${jsonPath}`);
  console.log("No Google Sheets data was written.");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
