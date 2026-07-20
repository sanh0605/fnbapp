import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/** Read-only: dumps all Recipes rows for a given semi-product id. */

async function main() {
  const spId = process.argv[2];
  if (!spId) {
    console.error("Usage: npx tsx scripts/inspect-semiproduct-recipe-versions.ts <semi_product_id>");
    process.exit(1);
  }
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [recipes, semiProducts] = await Promise.all([
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const sp = (semiProducts as any[]).find(s => s.id === spId);
  console.log(`${spId} (${sp?.name}) current batch_yield=${sp?.batch_yield}`);

  const spRecipes = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT" && r.target_id === spId);
  console.log(`\nRecipe rows (${spRecipes.length}):`);
  for (const r of spRecipes) {
    console.log(`  status=${r.status} start_date=${r.start_date} end_date=${r.end_date} created_at=${r.created_at}`);
    console.log(`    ingredients_json=${r.ingredients_json}`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
