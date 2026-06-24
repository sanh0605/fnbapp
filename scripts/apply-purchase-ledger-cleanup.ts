import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const MANUAL_CONVERSION_BY_LINE_ID: Record<string, string> = {
  "POL-044": "QD-038",
  "POL-050": "QD-043",
  "POL-084": "QD-051",
  "POL-085": "QD-043",
};

const STRAWBERRY_LEDGER_FIXES: Record<string, { quantity_change: string; unit_cost: string }> = {
  "PO-023": { quantity_change: "1000", unit_cost: "411.6" },
  "PO-033": { quantity_change: "1000", unit_cost: "545.28" },
  "PO-034": { quantity_change: "1000", unit_cost: "445.5" },
};

async function main() {
  const apply = process.argv.includes("--apply");
  const { auditPurchaseLedger } = await import("../lib/purchase-ledger-audit");
  const { findAllNoCache, getSheetsClient } = await import("../lib/sheets_db");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  console.log(`Loading purchase cleanup data (${apply ? "APPLY" : "DRY-RUN"})...`);
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

  const conversionUpdates = new Map<string, string>();
  for (const backfill of report.safeBackfills) {
    conversionUpdates.set(backfill.line_id, backfill.conversion_id);
  }
  for (const [lineId, conversionId] of Object.entries(MANUAL_CONVERSION_BY_LINE_ID)) {
    conversionUpdates.set(lineId, conversionId);
  }

  const ledgerUpdates = Object.entries(STRAWBERRY_LEDGER_FIXES).map(([poId, fix]) => {
    const ledgerRow = (stockLedger as any[]).find(row =>
      row.reference_id === poId &&
      row.transaction_type === "PO_RECEIPT" &&
      row.item_reference === "ING-028",
    );
    return { poId, ledgerRow, fix };
  });

  const missingLedgerRows = ledgerUpdates.filter(row => !row.ledgerRow);
  const missingLines = [...conversionUpdates.keys()].filter(lineId =>
    !(purchaseOrderLines as any[]).some(row => row.id === lineId),
  );

  console.log("\n=== PURCHASE LEDGER CLEANUP PLAN ===");
  console.log(`Mode:                  ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Safe backfills:        ${report.safeBackfills.length}`);
  console.log(`Manual backfills:      ${Object.keys(MANUAL_CONVERSION_BY_LINE_ID).length}`);
  console.log(`Total line updates:    ${conversionUpdates.size}`);
  console.log(`Ledger row updates:    ${ledgerUpdates.length}`);
  console.log(`Missing line rows:     ${missingLines.length}`);
  console.log(`Missing ledger rows:   ${missingLedgerRows.length}`);

  console.log("\nManual conversion mappings:");
  for (const [lineId, conversionId] of Object.entries(MANUAL_CONVERSION_BY_LINE_ID)) {
    console.log(`  ${lineId} -> ${conversionId}`);
  }

  console.log("\nLedger fixes:");
  for (const row of ledgerUpdates) {
    console.log(
      `  ${row.poId}: ledger=${row.ledgerRow?.id || "MISSING"} qty=${row.fix.quantity_change} unit_cost=${row.fix.unit_cost}`,
    );
  }

  if (missingLines.length > 0 || missingLedgerRows.length > 0) {
    throw new Error("Cleanup plan has missing rows; refusing to continue.");
  }

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply to write this approved cleanup.");
    return;
  }

  const sheets = getSheetsClient();
  const batchData = [];

  const poLineRowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Purchase_Order_Lines!A1:ZZ",
  });
  const poLineRows = poLineRowsRes.data.values || [];
  const poLineHeaders = poLineRows[0] || [];
  const poLineIdIndex = poLineHeaders.indexOf("id");
  if (poLineIdIndex === -1) throw new Error("Purchase_Order_Lines is missing id column");
  let conversionIdIndex = poLineHeaders.indexOf("conversion_id");
  if (conversionIdIndex === -1) {
    conversionIdIndex = poLineHeaders.length;
    batchData.push({
      range: `Purchase_Order_Lines!${getColName(conversionIdIndex)}1`,
      values: [["conversion_id"]],
    });
  }
  const poLineRowById = new Map<string, number>();
  for (let i = 1; i < poLineRows.length; i++) {
    poLineRowById.set(poLineRows[i][poLineIdIndex], i + 1);
  }
  for (const [lineId, conversionId] of conversionUpdates.entries()) {
    const rowNum = poLineRowById.get(lineId);
    if (!rowNum) throw new Error(`Missing Purchase_Order_Lines row ${lineId}`);
    batchData.push({
      range: `Purchase_Order_Lines!${getColName(conversionIdIndex)}${rowNum}`,
      values: [[conversionId]],
    });
  }

  const ledgerRowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Stock_Ledger!A1:ZZ",
  });
  const ledgerRows = ledgerRowsRes.data.values || [];
  const ledgerHeaders = ledgerRows[0] || [];
  const ledgerIdIndex = ledgerHeaders.indexOf("id");
  const qtyIndex = ledgerHeaders.indexOf("quantity_change");
  const unitCostIndex = ledgerHeaders.indexOf("unit_cost");
  if (ledgerIdIndex === -1 || qtyIndex === -1 || unitCostIndex === -1) {
    throw new Error("Stock_Ledger is missing id, quantity_change, or unit_cost column");
  }
  const ledgerRowById = new Map<string, number>();
  for (let i = 1; i < ledgerRows.length; i++) {
    ledgerRowById.set(ledgerRows[i][ledgerIdIndex], i + 1);
  }
  for (const row of ledgerUpdates) {
    const rowNum = ledgerRowById.get(row.ledgerRow.id);
    if (!rowNum) throw new Error(`Missing Stock_Ledger row ${row.ledgerRow.id}`);
    batchData.push({
      range: `Stock_Ledger!${getColName(qtyIndex)}${rowNum}`,
      values: [[row.fix.quantity_change]],
    });
    batchData.push({
      range: `Stock_Ledger!${getColName(unitCostIndex)}${rowNum}`,
      values: [[row.fix.unit_cost]],
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: batchData,
    },
  });

  console.log("\nCleanup applied successfully.");
}

function getColName(index: number): string {
  let colName = "";
  let temp = index;
  while (temp >= 0) {
    colName = String.fromCharCode(65 + (temp % 26)) + colName;
    temp = Math.floor(temp / 26) - 1;
  }
  return colName;
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
