import * as dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { auditMacCogsDrift } from "../lib/mac-cogs-audit";
import { buildMacDriftBaselineReport } from "../lib/mac-drift-baseline";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const REPORT_PATH = "docs/audits/2026-07-09-mac-drift-baseline-lines.json";
const BASELINE_DOCUMENT_DATE = "2026-07-02T23:59:59.999Z";

function fmtMoney(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString("vi-VN")} VND`;
}

async function main(): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, ledger, recipes, semiProducts, events] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Order_Events"),
  ]);

  const drift = auditMacCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });
  const baseline = buildMacDriftBaselineReport({
    drift,
    orders: orders as any[],
    events: events as any[],
    baselineDocumentDate: BASELINE_DOCUMENT_DATE,
  });

  writeJsonReport(REPORT_PATH, {
    generated_at: new Date().toISOString(),
    baseline_document_date: BASELINE_DOCUMENT_DATE,
    summary: {
      line_count: baseline.lineCount,
      total_delta: baseline.totalDelta,
      mismatched_line_delta: baseline.mismatchedLineDelta,
      migrated_order_line_count: baseline.migratedOrderCount,
      non_migrated_order_line_count: baseline.nonMigratedOrderCount,
      after_baseline_document_count: baseline.afterBaselineDocumentCount,
      after_baseline_document_delta: baseline.afterBaselineDocumentDelta,
    },
    by_date: baseline.byDate,
    by_classification: baseline.byClassification,
    by_product: baseline.byProduct,
    lines: baseline.lines,
  });

  console.log("=== MAC DRIFT BASELINE AUDIT (READ ONLY) ===");
  console.log(`Mismatched lines:       ${baseline.lineCount}`);
  console.log(`Total delta:            ${fmtMoney(baseline.totalDelta)}`);
  console.log(`Mismatch-line delta:    ${fmtMoney(baseline.mismatchedLineDelta)}`);
  console.log(`Migrated-order lines:   ${baseline.migratedOrderCount}`);
  console.log(`Non-migrated lines:     ${baseline.nonMigratedOrderCount}`);
  console.log(`After ${BASELINE_DOCUMENT_DATE.slice(0, 10)}: ${baseline.afterBaselineDocumentCount} / ${fmtMoney(baseline.afterBaselineDocumentDelta)}`);
  console.log(`JSON artifact:          ${REPORT_PATH}`);

  console.log("\nBy classification");
  for (const row of baseline.byClassification) {
    console.log(`${row.classification}: ${row.count} / ${fmtMoney(row.delta)}`);
  }

  console.log("\nBy date");
  for (const row of baseline.byDate) {
    console.log(`${row.date}: ${row.count} / ${fmtMoney(row.delta)}`);
  }

  console.log("\nTop products by absolute delta");
  for (const row of baseline.byProduct.slice(0, 15)) {
    console.log(`${row.product_id}: ${row.count} / ${fmtMoney(row.delta)}`);
  }

  console.log("\nPost-baseline-document lines");
  for (const line of baseline.lines.filter(line => line.isAfterBaselineDocument)) {
    console.log(
      [
        line.order_no,
        `line=${line.line_id}`,
        `date=${line.created_at}`,
        `class=${line.classification}`,
        `product=${line.product_id}`,
        `stored=${line.stored_cost}`,
        `expected=${line.expected_cost}`,
        `delta=${line.delta}`,
        `migrated=${line.isMigratedOrder}`,
      ].join(" | "),
    );
  }

  console.log("\nNo database rows were written.");
}

function writeJsonReport(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
