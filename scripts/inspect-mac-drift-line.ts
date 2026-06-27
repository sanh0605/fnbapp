/**
 * Inspect specific mismatched lines to understand root cause.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const { buildLineConsumptionRows } = await import("../lib/inventory-consumption");
  const { buildSemiProductRecipeMaps } = await import("../lib/mac-cogs-audit");
  const { computeMacCostForConsumptionRows } = await import("../lib/mac-cogs");
  const { buildInventoryBalances } = await import("../lib/inventory-consumption");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  const targetLineId = "ol-2050e85f-56b3-4182-ba4e-a896b60ef966"; // UCK000277 PROD-023
  const line = (lines as any[]).find(l => l.id === targetLineId);
  if (!line) {
    console.log("Line not found");
    return;
  }

  const order = (orders as any[]).find(o => o.id === line.order_id);
  console.log("=== LINE INSPECTION ===");
  console.log(`order=${order?.order_no} created_at=${order?.created_at}`);
  console.log(`line.product_id=${line.product_id} variant=${line.variant_id} qty=${line.qty}`);
  console.log(`line.cost_at_sale=${line.cost_at_sale} (stored)`);
  console.log(`line.recipe_snapshot_json length=${(line.recipe_snapshot_json || "").length}`);

  // Parse recipe.
  const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
  console.log(`\nrecipe.variant.target_id=${recipe.variant.target_id}`);
  console.log(`recipe.variant.ingredients.length=${recipe.variant.ingredients.length}`);
  for (const ing of recipe.variant.ingredients) {
    console.log(`  variant ingredient: type=${ing.ingredient_type} id=${ing.ingredient_id} qty=${ing.quantity} unit=${ing.unit_id}`);
  }
  console.log(`recipe.modifiers.length=${recipe.modifiers.length}`);
  for (const m of recipe.modifiers) {
    console.log(`  modifier id=${m.modifier_id} qty=${m.modifier_qty} recipe.ingredients=${m.recipe.ingredients.length}`);
    for (const ing of m.recipe.ingredients) {
      console.log(`    mod ingredient: type=${ing.ingredient_type} id=${ing.ingredient_id} qty=${ing.quantity}`);
    }
  }

  // Build ledger before order time.
  const orderTime = new Date(order.created_at).getTime();
  const ledgerBeforeOrder = (ledger as any[])
    .filter(r => new Date(r.created_at || 0).getTime() <= orderTime && r.reference_id !== order.id)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  console.log(`\nledgerBeforeOrder.length=${ledgerBeforeOrder.length}`);

  const balances = buildInventoryBalances(ledgerBeforeOrder, order.created_at);
  const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[]);
  const consumptionRows = buildLineConsumptionRows(recipe, Number(line.qty), balances, consumptionMaps);

  console.log(`\nconsumptionRows (${consumptionRows.length}):`);
  for (const row of consumptionRows) {
    console.log(`  source=${row.source} item=${row.item_reference} qty=${row.quantity}`);
  }

  const expectedCost = computeMacCostForConsumptionRows(consumptionRows, ledgerBeforeOrder, order.created_at, consumptionMaps);
  console.log(`\nexpectedCost (recomputed)=${expectedCost}`);
  console.log(`storedCost=${Number(line.cost_at_sale || 0)}`);
  console.log(`delta=${expectedCost - Number(line.cost_at_sale || 0)}`);

  // Check which BTP ran shortfall.
  console.log(`\nBTP balances at order time:`);
  for (const btp of ["BTP-008", "BTP-003", "BTP-010", "BTP-002", "BTP-011"]) {
    const bal = balances.get(btp) || 0;
    console.log(`  ${btp}: ${bal}`);
  }

  // Check ledger entries for BTP-008 (Hồng trà) — first BTP that's likely shortfall for PROD-023.
  console.log(`\nBTP-008 ledger before order:`);
  const btp008Entries = ledgerBeforeOrder.filter(r => r.item_reference === "BTP-008");
  for (const r of btp008Entries.slice(-10)) {
    console.log(`  ${r.created_at} | ${r.transaction_type} qty=${r.quantity_change} unit_cost=${r.unit_cost || 0} ref=${r.reference_id}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
