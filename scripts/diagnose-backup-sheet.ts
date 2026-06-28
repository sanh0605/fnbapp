/**
 * Diagnose Sheets pollution after Phase E edge function bug.
 *
 * Bug: edge function appended rows with 20-column format into sheet that
 * has 26+ columns. Plus inserted duplicate header mid-data.
 *
 * This script reads Orders_V2 + Order_Lines_V2 sheets, identifies polluted
 * rows, and prints a cleanup plan (no writes).
 *
 * Claude code — Supabase migration Phase E cleanup.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { readAllFromSheets } = await import("../lib/sheets-source");

  for (const sheetName of ["Orders_V2", "Order_Lines_V2"]) {
    console.log(`\n=== ${sheetName} ===`);
    const { headers, rows } = await readAllFromSheets(sheetName);
    console.log(`Total rows (excl header): ${rows.length}`);
    console.log(`Header columns (${headers.length}): ${headers.join(", ")}`);

    // Find duplicate header rows (col id == "id" string).
    const headerIndices: number[] = [];
    rows.forEach((row, idx) => {
      if (row.id === "id") headerIndices.push(idx + 2); // +2 because 1-indexed + header offset
    });
    console.log(`Duplicate 'id' header rows at sheet row: ${headerIndices.join(", ") || "(none)"}`);

    // Identify polluted rows: rows where expected full-data column is empty.
    // For Orders_V2: column 'pos_snapshot_json' (or last column).
    // For Order_Lines_V2: column 'recipe_snapshot_json' or 'modifiers_snapshot_json'.
    const checkCol =
      sheetName === "Orders_V2"
        ? "pos_snapshot_json"
        : "recipe_snapshot_json";
    const colIdx = headers.indexOf(checkCol);
    if (colIdx === -1) {
      console.log(`Cannot find check column ${checkCol}`);
      continue;
    }
    const emptyCheckRows: number[] = [];
    rows.forEach((row, idx) => {
      const val = row[checkCol];
      if (!val || val === "" || val === "{}" || val === "[]") {
        emptyCheckRows.push(idx + 2);
      }
    });
    console.log(`Rows with empty ${checkCol} (likely polluted): ${emptyCheckRows.length}`);
    if (emptyCheckRows.length > 0) {
      console.log(`First polluted row: ${emptyCheckRows[0]}`);
      console.log(`Last polluted row: ${emptyCheckRows[emptyCheckRows.length - 1]}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
