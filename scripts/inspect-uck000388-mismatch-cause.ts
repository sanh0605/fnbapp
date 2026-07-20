import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only inspection of UCK000388 (one of the 102 deferred mismatch
 * orders) to find the exact root cause of the recorded-vs-recomputed
 * quantity ratio (a clean, consistent 7/3 across multiple raw ingredients on
 * the same shortfall event). Hypothesis: unlike Recipes (which are
 * time-versioned via start_date/end_date and already correctly selected by
 * order.created_at in the correction script), Semi_Products.batch_yield is a
 * single, non-versioned scalar column -- if it changed after this order was
 * sold, any recompute using today's batch_yield will silently diverge from
 * what was actually used at sale time, with no way to recover the old value
 * except by reverse-deriving it from the order's own recorded ledger rows.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const order = (orders as any[]).find(o => o.order_no === "UCK000388");
  if (!order) {
    console.error("Order not found");
    process.exit(1);
  }
  console.log(`Order UCK000388: id=${order.id} status=${order.status} created_at=${order.created_at}`);

  const orderLines = (lines as any[]).filter(l => l.order_id === order.id);
  for (const line of orderLines) {
    console.log(`\nLine ${line.id} qty=${line.qty} cost_at_sale=${line.cost_at_sale}`);
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
    console.log(`  variant target_id=${recipe.variant.target_id}`);
    for (const ing of recipe.variant.ingredients) {
      console.log(`    ingredient=${ing.ingredient_id} type=${ing.ingredient_type} quantity=${ing.quantity}`);
    }
    for (const modifier of recipe.modifiers) {
      console.log(`  modifier id=${modifier.modifier_id} modifier_qty=${modifier.modifier_qty}`);
      for (const ing of modifier.recipe.ingredients) {
        console.log(`    ingredient=${ing.ingredient_id} type=${ing.ingredient_type} quantity=${ing.quantity}`);
      }
    }
  }

  console.log(`\nLedger rows for this order:`);
  const orderLedgerRows = (ledger as any[])
    .filter(r => r.reference_id === order.id)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  for (const r of orderLedgerRows) {
    console.log([r.created_at, r.transaction_type, r.item_reference, `qty=${r.quantity_change}`, `source=${r.source}`].join(" | "));
  }

  const semiProductIds = new Set<string>();
  for (const line of orderLines) {
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
    for (const ing of recipe.variant.ingredients) {
      if (ing.ingredient_type === "SEMI_PRODUCT") semiProductIds.add(ing.ingredient_id);
    }
    for (const modifier of recipe.modifiers) {
      for (const ing of modifier.recipe.ingredients) {
        if (ing.ingredient_type === "SEMI_PRODUCT") semiProductIds.add(ing.ingredient_id);
      }
    }
  }

  console.log(`\nSemi-products referenced: ${[...semiProductIds].join(", ")}`);
  for (const spId of semiProductIds) {
    const sp = (semiProducts as any[]).find(s => s.id === spId);
    console.log(`  ${spId}: current batch_yield=${sp?.batch_yield}`);
    const spRecipes = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT" && r.target_id === spId);
    for (const r of spRecipes) {
      console.log(`    recipe row: status=${r.status} start_date=${r.start_date} end_date=${r.end_date} created_at=${r.created_at}`);
      console.log(`      ingredients_json=${r.ingredients_json}`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
