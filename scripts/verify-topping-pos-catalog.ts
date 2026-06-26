/**
 * Verify POS catalog will show the 7 new standalone toppings.
 *
 * Mirrors the filtering logic in app/pos/page.tsx (after the 2026-06-27
 * ACTIVE-only fix) and prints what POS would render for the Topping category.
 */

process.env.CLI_MODE = "true";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [categories, products, variants] = await Promise.all([
    findAllNoCache("Product_Categories"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
  ]);

  // Mirror app/pos/page.tsx after fix
  const activeCategories = (categories as any[]).filter((c) => c.status === "ACTIVE");
  const activeProducts = (products as any[]).filter((p) => p.status === "ACTIVE");
  const activeVariants = (variants as any[]).filter((v) => v.status === "ACTIVE");

  const toppingCat = activeCategories.find(
    (c) => String(c.id) === "CAT-007" || /topping/i.test(String(c.name)),
  );
  if (!toppingCat) {
    console.error("FAIL: Topping category not found in ACTIVE categories.");
    process.exit(1);
  }

  console.log(`=== POS catalog simulation (ACTIVE only) ===`);
  console.log(`Category tab: "${toppingCat.name}" (id=${toppingCat.id}) will appear in POS`);
  console.log();

  const toppingProducts = activeProducts.filter((p) => String(p.category_id) === String(toppingCat.id));
  console.log(`Topping products visible in POS: ${toppingProducts.length}`);
  for (const p of toppingProducts) {
    const variant = activeVariants.find((v) => String(v.product_id) === String(p.id));
    console.log(
      `  ${p.id} | ${p.name} | status=${p.status} | variant=${variant?.id || "(none)"} size="${variant?.size_name}" price=${variant?.price}`,
    );
  }

  const expected = 7;
  if (toppingProducts.length !== expected) {
    console.error(`\nFAIL: expected ${expected} toppings, got ${toppingProducts.length}.`);
    process.exit(1);
  }
  console.log(`\nOK: ${expected}/${expected} toppings will appear in POS.`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
