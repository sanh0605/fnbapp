import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";
import * as fs from "fs";

/**
 * Phase 1 of docs/superpowers/plans/2026-08-27-remove-recipes-and-semi-products.md.
 *
 * Exports every row of recipes, semi_products, and the 11 semi-product
 * inventory_balances rows to docs/audits/2026-08-27-recipes-semi-products-backup.json,
 * every column, unfiltered. Deletes nothing -- this is the only step
 * approved to run this session; phases 2 (code removal) and 3 (data
 * deletion) come back to the owner before they run.
 *
 * Once written, this file is the thing CLAUDE.md section 11 protects:
 * "File .json trong do la du lieu, co cai la ban sao luu duy nhat cua du
 * lieu da xoa -- khong dung vao."
 */

const OUTPUT_PATH = "docs/audits/2026-08-27-recipes-semi-products-backup.json";

async function main(): Promise<void> {
  const { findAll } = await import("@/lib/sheets_db");

  const [recipes, semiProducts, allInventoryBalances] = await Promise.all([
    findAll("Recipes"),
    findAll("Semi_Products"),
    findAll("Inventory_Balances"),
  ]) as any[][];

  const semiProductIds = new Set(semiProducts.map((s: any) => s.id));
  const semiProductInventoryBalances = allInventoryBalances.filter((b: any) =>
    semiProductIds.has(b.item_reference),
  );

  console.log(`recipes: ${recipes.length} rows`);
  console.log(`semi_products: ${semiProducts.length} rows`);
  console.log(`inventory_balances for a semi-product: ${semiProductInventoryBalances.length} rows`);

  const backup = {
    generated_at: new Date().toISOString(),
    purpose:
      "docs/superpowers/plans/2026-08-27-remove-recipes-and-semi-products.md phase 1 -- " +
      "full-row backup of recipes, semi_products, and the semi-product rows in " +
      "inventory_balances, taken before any code removal or deletion. Order lines' " +
      "own recipe_snapshot_json reconstructs most but not all of this (see the " +
      "plan's section 7 and its critique for the exact count and what it depends " +
      "on); after phase 3 this file is the only surviving copy for whatever a " +
      "snapshot cannot reconstruct, and the only copy at all for the semi-product " +
      "and modifier recipes, which no order line snapshot ever restates in full.",
    counts: {
      recipes: recipes.length,
      semi_products: semiProducts.length,
      inventory_balances_semi_product: semiProductInventoryBalances.length,
    },
    recipes,
    semi_products: semiProducts,
    inventory_balances_semi_product: semiProductInventoryBalances,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(backup, null, 2));
  console.log(`\nWrote ${OUTPUT_PATH}`);

  // Verify: re-read the file from disk (not the in-memory object) and
  // confirm row counts match exactly -- "a backup nobody opened is not a
  // backup" (plan section 3).
  const reread = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  const checks: Array<[string, boolean]> = [
    ["recipes count", reread.recipes.length === recipes.length],
    ["semi_products count", reread.semi_products.length === semiProducts.length],
    ["inventory_balances_semi_product count", reread.inventory_balances_semi_product.length === semiProductInventoryBalances.length],
    ["recipes content matches (deep)", JSON.stringify(reread.recipes) === JSON.stringify(recipes)],
    ["semi_products content matches (deep)", JSON.stringify(reread.semi_products) === JSON.stringify(semiProducts)],
    ["inventory_balances content matches (deep)", JSON.stringify(reread.inventory_balances_semi_product) === JSON.stringify(semiProductInventoryBalances)],
  ];
  console.log("\n=== Re-read verification ===");
  let allOk = true;
  for (const [label, ok] of checks) {
    console.log(`${ok ? "OK" : "FAIL"}: ${label}`);
    if (!ok) allOk = false;
  }
  if (!allOk) {
    console.error("\nBACKUP VERIFICATION FAILED -- do not treat this file as reliable.");
    process.exit(1);
  }
  console.log("\nBackup verified: re-read from disk, counts and content match the live query exactly.");
}

main().catch(e => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
