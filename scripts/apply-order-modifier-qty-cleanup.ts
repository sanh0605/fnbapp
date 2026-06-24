import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type UpdateCell = {
  range: string;
  values: Array<Array<string | number>>;
};

function colName(index: number): string {
  let name = "";
  let value = index;
  while (value >= 0) {
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26) - 1;
  }
  return name;
}

function parseJson(raw: string, fallback: any) {
  try {
    return JSON.parse(raw || "");
  } catch {
    return fallback;
  }
}

function mapRows(headers: string[], rows: string[][]): Array<any & { __rowNumber: number }> {
  return rows.slice(1).map((row, rowIndex) => {
    const obj: any = { __rowNumber: rowIndex + 2 };
    headers.forEach((header, index) => {
      obj[header] = row[index] || "";
    });
    return obj;
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSheetsClient } = await import("../lib/sheets_db");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID is required");

  const sheets = getSheetsClient();
  const [ordersRes, linesRes, ledgerRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Orders_V2!A1:ZZ" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Order_Lines_V2!A1:ZZ" }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: "Stock_Ledger!A1:ZZ" }),
  ]);

  const orderRows = ordersRes.data.values || [];
  const lineRows = linesRes.data.values || [];
  const ledgerRows = ledgerRes.data.values || [];
  const orderHeaders = orderRows[0] || [];
  const lineHeaders = lineRows[0] || [];
  const ledgerHeaders = ledgerRows[0] || [];

  const orders = mapRows(orderHeaders, orderRows);
  const lines = mapRows(lineHeaders, lineRows);
  const ledger = mapRows(ledgerHeaders, ledgerRows);
  const orderById = new Map(orders.map((order: any) => [order.id, order]));

  const lineUpdates: UpdateCell[] = [];
  const ledgerUpdates: UpdateCell[] = [];
  const recipeCol = colName(lineHeaders.indexOf("recipe_snapshot_json"));
  const ledgerQtyCol = colName(ledgerHeaders.indexOf("quantity_change"));

  for (const line of lines) {
    const modifiers = parseJson(line.modifiers_snapshot_json, []);
    const recipe = parseJson(line.recipe_snapshot_json, {});
    if (!Array.isArray(modifiers) || !Array.isArray(recipe.modifiers)) continue;

    let changedRecipe = false;
    for (const modifier of modifiers) {
      const modifierId = String(modifier.id || "");
      const modifierQty = Number(modifier.qty || 1);
      const recipeEntry = recipe.modifiers.find((entry: any) => entry.modifier_id === modifierId);
      if (!recipeEntry || modifierQty <= 1 || Number(recipeEntry.modifier_qty || 1) === modifierQty) continue;

      recipeEntry.modifier_qty = modifierQty;
      changedRecipe = true;

      const lineQty = Number(line.qty || 0);
      for (const ingredient of recipeEntry.recipe?.ingredients || []) {
        const oldQty = -(Number(ingredient.quantity || 0) * lineQty);
        const newQty = oldQty * modifierQty;
        const candidates = ledger.filter((row: any) =>
          row.reference_id === line.order_id &&
          row.transaction_type === "SALES_CONSUME" &&
          row.item_reference === ingredient.ingredient_id &&
          Number(row.quantity_change) === oldQty,
        );

        if (candidates.length !== 1) {
          const order = orderById.get(line.order_id);
          throw new Error(
            `Ambiguous ledger update for ${order?.order_no || line.order_id} line=${line.id} ingredient=${ingredient.ingredient_id} candidates=${candidates.length}`,
          );
        }

        ledgerUpdates.push({
          range: `Stock_Ledger!${ledgerQtyCol}${candidates[0].__rowNumber}`,
          values: [[newQty]],
        });
      }
    }

    if (changedRecipe) {
      lineUpdates.push({
        range: `Order_Lines_V2!${recipeCol}${line.__rowNumber}`,
        values: [[JSON.stringify(recipe)]],
      });
    }
  }

  console.log("=== Order modifier qty cleanup ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Line recipe updates: ${lineUpdates.length}`);
  console.log(`Ledger qty updates: ${ledgerUpdates.length}`);
  [...lineUpdates, ...ledgerUpdates].forEach(update => console.log(`${update.range} => ${update.values[0][0]}`));

  if (!apply) {
    console.log("No data was written. Re-run with --apply to update.");
    return;
  }

  const data = [...lineUpdates, ...ledgerUpdates];
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
  console.log(`Updated ${data.length} cell(s).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
