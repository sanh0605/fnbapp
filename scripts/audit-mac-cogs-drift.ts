import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmtMoney(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

function fmtDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmtMoney(value)}`;
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const {
    allocateRecipeConsumption,
    buildInventoryBalances,
    buildSemiProductRecipeMaps,
  } = await import("../lib/inventory-consumption");
  const { computeMacCostForConsumptionRows } = await import("../lib/mac-cogs");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  const activeOrders = (orders as any[])
    .filter(order => order.status === "COMPLETED" && !order.superseded_by && order.created_at)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const activeOrderIds = new Set(activeOrders.map(order => order.id));

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[]);
  const mismatches: any[] = [];
  let totalStored = 0;
  let totalExpected = 0;

  for (const order of activeOrders) {
    const orderLines = linesByOrder.get(order.id) || [];
    const orderTime = new Date(order.created_at || 0).getTime();
    const ledgerBeforeOrder = (ledger as any[]).filter(row => {
      const rowTime = new Date(row.created_at || 0).getTime();
      if (rowTime > orderTime) return false;
      return row.reference_id !== order.id;
    });
    const balances = buildInventoryBalances(ledgerBeforeOrder, order.created_at);

    for (const line of orderLines) {
      const stored = Number(line.cost_at_sale || 0);
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
      const rows: any[] = [];
      rows.push(...allocateRecipeConsumption({
        ingredients: lineRecipe.variant.ingredients,
        multiplier: Number(line.qty || 0),
        balances,
        ...consumptionMaps,
        source: "VARIANT_RECIPE",
      }));
      for (const modifier of lineRecipe.modifiers) {
        rows.push(...allocateRecipeConsumption({
          ingredients: modifier.recipe.ingredients,
          multiplier: Number(line.qty || 0) * Number(modifier.modifier_qty || 1),
          balances,
          ...consumptionMaps,
          source: `MODIFIER_RECIPE:${modifier.modifier_id}`,
        }));
      }

      const expected = computeMacCostForConsumptionRows(rows, ledgerBeforeOrder, order.created_at, consumptionMaps);
      const delta = expected - stored;
      totalStored += stored;
      totalExpected += expected;
      if (Math.abs(delta) > 1) {
        mismatches.push({
          order_no: order.order_no || order.id,
          order_id: order.id,
          line_id: line.id,
          product_id: line.product_id,
          variant_id: line.variant_id,
          qty: Number(line.qty || 0),
          stored,
          expected,
          delta,
          created_at: order.created_at,
        });
      }
    }
  }

  mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  console.log("=== MAC COGS DRIFT AUDIT (READ ONLY) ===");
  console.log(`Eligible orders:       ${activeOrders.length}`);
  console.log(`Eligible lines:        ${(lines as any[]).filter(line => activeOrderIds.has(line.order_id)).length}`);
  console.log(`Mismatched lines:      ${mismatches.length}`);
  console.log(`Stored COGS:           ${fmtMoney(totalStored)}`);
  console.log(`Expected MAC COGS:     ${fmtMoney(totalExpected)}`);
  console.log(`Delta:                 ${fmtDelta(totalExpected - totalStored)}`);

  if (mismatches.length > 0) {
    console.log("\nTop mismatched lines");
    for (const row of mismatches.slice(0, 30)) {
      console.log([
        row.order_no,
        `line=${row.line_id}`,
        `product=${row.product_id}`,
        `variant=${row.variant_id}`,
        `qty=${row.qty}`,
        `stored=${fmtMoney(row.stored)}`,
        `mac=${fmtMoney(row.expected)}`,
        `delta=${fmtDelta(row.delta)}`,
      ].join(" | "));
    }
  }

  console.log("\nNo data was written.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
