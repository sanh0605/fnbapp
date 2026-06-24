import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function parseJsonArray(raw: string): any[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseRecipe(raw: string): any {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ]);

  const orderById = new Map(orders.map((order: any) => [order.id, order]));
  const rows: any[] = [];

  for (const line of lines) {
    const modifiers = parseJsonArray(line.modifiers_snapshot_json);
    const recipe = parseRecipe(line.recipe_snapshot_json);
    const recipeModifiers = Array.isArray(recipe.modifiers) ? recipe.modifiers : [];
    const qtyById = new Map(modifiers.map((mod: any) => [String(mod.id || ""), Number(mod.qty || 1)]));

    for (const [modifierId, modifierQty] of qtyById.entries()) {
      const recipeEntry = recipeModifiers.find((entry: any) => entry.modifier_id === modifierId);
      const recipeQty = Number(recipeEntry?.modifier_qty || 1);
      if (modifierQty !== 1 || recipeQty !== modifierQty) {
        const order = orderById.get(line.order_id) || {};
        rows.push({
          order_no: order.order_no || line.order_id,
          created_at: order.created_at || "",
          line_id: line.id,
          product_id: line.product_id,
          variant_id: line.variant_id,
          line_qty: Number(line.qty || 0),
          modifier_id: modifierId,
          modifier_qty: modifierQty,
          recipe_modifier_qty: recipeEntry?.modifier_qty ?? "(missing)",
          status: recipeQty === modifierQty ? "OK_QTY_GT_1" : "MISMATCH",
        });
      }
    }
  }

  rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  console.log("=== Order modifier qty audit ===");
  const mismatchRows = rows.filter(row => row.status === "MISMATCH");
  console.log(`Lines with modifier qty > 1: ${new Set(rows.map(row => row.line_id)).size}`);
  console.log(`Modifier rows with qty > 1: ${rows.length}`);
  console.log(`Snapshot mismatches: ${mismatchRows.length}`);
  for (const row of rows.slice(0, 100)) {
    console.log([
      `[${row.status}]`,
      row.order_no,
      `created=${row.created_at}`,
      `line=${row.line_id}`,
      `product=${row.product_id}`,
      `variant=${row.variant_id}`,
      `line_qty=${row.line_qty}`,
      `modifier=${row.modifier_id}`,
      `modifier_qty=${row.modifier_qty}`,
      `recipe_modifier_qty=${row.recipe_modifier_qty}`,
    ].join(" | "));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
