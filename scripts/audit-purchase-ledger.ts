import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const KNOWN_STRAWBERRY_POS = new Set(["PO-020", "PO-023", "PO-033", "PO-034"]);
const STRAWBERRY_ITEM = "SPM-033";
const STRAWBERRY_INGREDIENT = "ING-028";

function formatNumber(value: number, digits = 4): string {
  return value.toLocaleString("vi-VN", {
    maximumFractionDigits: digits,
  });
}

function printRows<T>(title: string, rows: T[], render: (row: T, index: number) => string): void {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("  Không có.");
    return;
  }
  rows.forEach((row, index) => console.log(render(row, index)));
}

async function main() {
  const { auditPurchaseLedger } = await import("../lib/purchase-ledger-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  console.log("Loading purchase ledger audit data...");
  const [purchaseOrders, purchaseOrderLines, purchasedItems, conversions, stockLedger] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("UOM_Conversions"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const report = auditPurchaseLedger({
    purchaseOrders: purchaseOrders as any[],
    purchaseOrderLines: purchaseOrderLines as any[],
    purchasedItems: purchasedItems as any[],
    conversions: conversions as any[],
    stockLedger: stockLedger as any[],
  });

  console.log("\n=== PURCHASE LEDGER AUDIT (READ ONLY) ===");
  console.log(`Completed POs:             ${report.completedPoCount}`);
  console.log(`Completed PO lines:        ${report.lineCount}`);
  console.log(`Expected ledger groups:    ${report.expectedLedgerGroupCount}`);
  console.log(`Actual ledger groups:      ${report.actualLedgerGroupCount}`);
  console.log(`Safe conversion backfills: ${report.safeBackfills.length}`);
  console.log(`Ambiguous conversion rows: ${report.ambiguousLines.length}`);
  console.log(`Missing conversion rows:   ${report.missingConversions.length}`);
  console.log(`Ledger mismatches:         ${report.ledgerMismatches.length}`);

  printRows("Top ledger mismatches", report.ledgerMismatches.slice(0, 30), (row, index) =>
    [
      `${index + 1}. po=${row.po_id}`,
      `item=${row.item_reference}`,
      `expected_qty=${formatNumber(row.expected_quantity)}`,
      `actual_qty=${formatNumber(row.actual_quantity)}`,
      `expected_unit_cost=${formatNumber(row.expected_unit_cost)}`,
      `actual_unit_cost=${formatNumber(row.actual_unit_cost)}`,
      `delta_qty=${formatNumber(row.delta_quantity)}`,
      `delta_cost=${formatNumber(row.delta_total_cost)}`,
    ].join(" | "),
  );

  printRows("Ambiguous conversion rows", report.ambiguousLines.slice(0, 30), (row, index) =>
    [
      `${index + 1}. po=${row.po_id}`,
      `line=${row.line_id}`,
      `item=${row.purchased_item_id}`,
      `unit=${row.unit}`,
      `candidates=${row.candidate_conversion_ids.join(",")}`,
    ].join(" | "),
  );

  printRows("Missing conversion rows", report.missingConversions.slice(0, 30), (row, index) =>
    [
      `${index + 1}. po=${row.po_id}`,
      `line=${row.line_id}`,
      `item=${row.purchased_item_id}`,
      `unit=${row.unit}`,
    ].join(" | "),
  );

  printRows("Safe backfill candidates", report.safeBackfills.slice(0, 30), (row, index) =>
    [
      `${index + 1}. po=${row.po_id}`,
      `line=${row.line_id}`,
      `item=${row.purchased_item_id}`,
      `unit=${row.unit}`,
      `conversion=${row.conversion_id}`,
      `rate=${formatNumber(row.conversion_rate)}`,
    ].join(" | "),
  );

  const strawberryLedger = (stockLedger as any[]).filter(row =>
    row.transaction_type === "PO_RECEIPT" &&
    row.item_reference === STRAWBERRY_INGREDIENT &&
    KNOWN_STRAWBERRY_POS.has(row.reference_id),
  );
  const strawberryLines = (purchaseOrderLines as any[]).filter(row =>
    row.purchased_item_id === STRAWBERRY_ITEM &&
    KNOWN_STRAWBERRY_POS.has(row.po_id),
  );
  const strawberryConversions = (conversions as any[]).filter(row =>
    row.purchased_item_id === STRAWBERRY_ITEM,
  );

  printRows("Known example: Dâu sấy ledger rows", strawberryLedger, (row, index) =>
    [
      `${index + 1}. po=${row.reference_id}`,
      `ledger=${row.id}`,
      `qty=${formatNumber(Number(row.quantity_change) || 0)}`,
      `unit_cost=${formatNumber(Number(row.unit_cost) || 0)}`,
    ].join(" | "),
  );

  printRows("Known example: Dâu sấy PO lines", strawberryLines, (row, index) =>
    [
      `${index + 1}. po=${row.po_id}`,
      `line=${row.id}`,
      `unit=${row.unit}`,
      `qty=${row.quantity}`,
      `subtotal=${row.subtotal}`,
      `conversion_id=${row.conversion_id || ""}`,
    ].join(" | "),
  );

  printRows("Known example: Dâu sấy conversions", strawberryConversions, (row, index) =>
    [
      `${index + 1}. conversion=${row.id}`,
      `unit=${row.purchased_unit}`,
      `base_unit=${row.base_unit}`,
      `rate=${row.conversion_rate}`,
    ].join(" | "),
  );

  console.log("\nNo data was written.");
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
