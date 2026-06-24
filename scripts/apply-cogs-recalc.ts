import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const apply = process.argv.includes("--apply");
  const { auditCogsDrift } = await import("../lib/cogs-drift-audit");
  const { findAllNoCache, getSheetsClient } = await import("../lib/sheets_db");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  console.log(`Loading COGS recalc data (${apply ? "APPLY" : "DRY-RUN"})...`);
  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  const report = auditCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });

  console.log("\n=== COGS RECALC PLAN ===");
  console.log(`Mode:              ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Mismatched orders: ${report.mismatchedOrderCount}`);
  console.log(`Mismatched lines:  ${report.mismatchedLineCount}`);
  console.log(`Stored COGS:       ${Math.round(report.totalStoredCogs).toLocaleString("vi-VN")}đ`);
  console.log(`Expected COGS:     ${Math.round(report.totalExpectedCogs).toLocaleString("vi-VN")}đ`);
  console.log(`Delta:             ${Math.round(report.totalDelta).toLocaleString("vi-VN")}đ`);
  report.lineMismatches.slice(0, 20).forEach((line, index) => {
    console.log(
      `${index + 1}. ${line.order_no} line=${line.line_id} stored=${line.stored_cost} fifo=${line.expected_cost} delta=${line.delta}`,
    );
  });

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply to update mismatched line COGS.");
    return;
  }
  if (report.lineMismatches.length === 0) {
    console.log("\nNo mismatched COGS lines to update.");
    return;
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Order_Lines_V2!A1:ZZ",
  });
  const rows = res.data.values || [];
  const headers = rows[0] || [];
  const idIndex = headers.indexOf("id");
  const costIndex = headers.indexOf("cost_at_sale");
  if (idIndex === -1 || costIndex === -1) {
    throw new Error("Order_Lines_V2 is missing id or cost_at_sale column");
  }

  const rowById = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    rowById.set(rows[i][idIndex], i + 1);
  }
  const costCol = getColName(costIndex);
  const data = report.lineMismatches.map(line => {
    const rowNum = rowById.get(line.line_id);
    if (!rowNum) throw new Error(`Missing Order_Lines_V2 row ${line.line_id}`);
    return {
      range: `Order_Lines_V2!${costCol}${rowNum}`,
      values: [[line.expected_cost]],
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });

  console.log(`\nUpdated ${data.length} Order_Lines_V2 cost_at_sale cells.`);
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
