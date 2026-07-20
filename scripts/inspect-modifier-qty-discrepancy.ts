import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only inspection: dumps a line's full recipe_snapshot_json (variant +
 * modifiers) and every stock_ledger row tied to the order, to figure out why
 * expectedNetByItem's recomputed quantity for a raw ingredient differs from
 * what was actually recorded by a fixed, non-modifier-related ratio (e.g.
 * expected 6 vs actual 8 for ING-004 across many orders in the 2026-07-20
 * historical-correction set).
 */

async function main() {
  const orderNo = process.argv[2];
  if (!orderNo) {
    console.error("Usage: npx tsx scripts/inspect-modifier-qty-discrepancy.ts <order_no>");
    process.exit(1);
  }

  const { findAllNoCache } = await import("../lib/sheets_db");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const [orders, lines, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]) as any[][];

  const order = (orders as any[]).find(o => o.order_no === orderNo);
  if (!order) {
    console.error(`Order ${orderNo} not found`);
    process.exit(1);
  }

  const orderLines = (lines as any[]).filter(l => l.order_id === order.id);
  console.log(`Order ${orderNo}: id=${order.id} status=${order.status} created_at=${order.created_at}`);

  for (const line of orderLines) {
    console.log(`\nLine ${line.id} qty=${line.qty} cost_at_sale=${line.cost_at_sale}`);
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
    console.log(`  variant target_id=${recipe.variant.target_id}`);
    for (const ing of recipe.variant.ingredients) {
      console.log(`    ingredient=${ing.ingredient_id} type=${ing.ingredient_type} quantity=${ing.quantity}`);
    }
    for (const modifier of recipe.modifiers) {
      console.log(`  modifier id=${modifier.modifier_id} name=${modifier.modifier_name} modifier_qty=${modifier.modifier_qty}`);
      for (const ing of modifier.recipe.ingredients) {
        console.log(`    ingredient=${ing.ingredient_id} type=${ing.ingredient_type} quantity=${ing.quantity}`);
      }
    }
  }

  console.log(`\nLedger rows for this order:`);
  const rows = (ledger as any[])
    .filter(r => r.reference_id === order.id)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  for (const r of rows) {
    console.log([
      r.created_at,
      r.transaction_type,
      r.item_reference,
      `qty=${r.quantity_change}`,
      `source=${r.source}`,
    ].join(" | "));
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
