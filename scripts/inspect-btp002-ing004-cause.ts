import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only: dumps all Recipes rows for BTP-002 and Semi_Products.batch_yield
 * to figure out why UCK000485 (order dated 2026-07-14, using
 * order.created_at correctly as the recipe asOf in the investigate script)
 * still recomputes ING-004 as 6 units when 8 units were actually recorded --
 * even though the investigate script (unlike the pre-fix audit tool) already
 * passes order.created_at into buildSemiProductRecipeMaps.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [recipes, semiProducts] = await Promise.all([
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const sp = (semiProducts as any[]).find(s => s.id === "BTP-002");
  console.log(`BTP-002 current batch_yield=${sp?.batch_yield}`);

  const spRecipes = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT" && r.target_id === "BTP-002");
  console.log(`\nBTP-002 recipe rows (${spRecipes.length}):`);
  for (const r of spRecipes) {
    console.log(`  status=${r.status} start_date=${r.start_date} end_date=${r.end_date} created_at=${r.created_at}`);
    console.log(`    ingredients_json=${r.ingredients_json}`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
