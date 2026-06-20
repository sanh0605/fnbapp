/**
 * Investigate PnL report bugs:
 * 1. Drink revenue doesn't end in 5k/0k (e.g., Cà phê đá 7.435đ/cup)
 * 2. Toppings have 0 COGS
 * 3. Verify promo attribution
 *
 * Run: npx tsx scripts/investigate-pnl-bugs.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const [orders, lines, products, variants, promotions] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Promotions"),
  ]);

  // Get the PRM-003 promo
  const promo = (promotions as any[]).find(p => p.id === "PRM-003");
  console.log("\n=== PRM-003 ===");
  console.log(`Type: ${promo?.type}, discount_type: ${promo?.discount_type}, value: ${promo?.discount_value}`);
  const applicable = JSON.parse(promo?.applicable_products_json || "{}");
  console.log(`Applicable variants count: ${Object.keys(applicable).length}`);

  // Find Cà phê đá product + variants
  const caPheDaProduct = (products as any[]).find(p => p.name && p.name.toLowerCase().includes("cà phê đá"));
  console.log(`\n=== Cà phê đá ===`);
  console.log(`Product:`, caPheDaProduct?.id, caPheDaProduct?.name);
  const caPheVariants = (variants as any[]).filter(v => v.product_id === caPheDaProduct?.id);
  for (const v of caPheVariants) {
    const inPromo = applicable[v.id];
    console.log(`  Variant ${v.id} (${v.size_name}) price=${v.price} → in PRM-003: ${inPromo ? `target ${inPromo}` : "NOT IN PROMO"}`);
  }

  // Get all V2 lines for Cà phê đá
  const caPheVariantIds = new Set(caPheVariants.map(v => v.id));
  const caPheLines = (lines as any[]).filter(l => caPheVariantIds.has(l.variant_id));
  console.log(`\n=== Cà phê đá V2 lines (${caPheLines.length} total) ===`);
  console.log("Sample 5 lines:");
  for (const l of caPheLines.slice(0, 5)) {
    console.log({
      qty: l.qty,
      unit_price: l.unit_price,
      gross_line_total: l.gross_line_total,
      promo_discount: l.promo_discount,
      manual_item_discount: l.manual_item_discount,
      order_discount_allocation: l.order_discount_allocation,
      net_line_total: l.net_line_total,
      cost_at_sale: l.cost_at_sale,
    });
  }

  // Per-cup analysis
  const totalQty = caPheLines.reduce((s, l) => s + Number(l.qty || 0), 0);
  const totalNet = caPheLines.reduce((s, l) => s + Number(l.net_line_total || 0), 0);
  const totalGross = caPheLines.reduce((s, l) => s + Number(l.gross_line_total || 0), 0);
  const totalPromo = caPheLines.reduce((s, l) => s + Number(l.promo_discount || 0), 0);
  const totalCost = caPheLines.reduce((s, l) => s + Number(l.cost_at_sale || 0), 0);
  console.log(`\nAggregates:`);
  console.log(`  Total qty: ${totalQty}`);
  console.log(`  Total gross: ${totalGross}`);
  console.log(`  Total promo: ${totalPromo}`);
  console.log(`  Total net: ${totalNet}`);
  console.log(`  Net per cup: ${totalNet / totalQty}`);
  console.log(`  Total cost_at_sale: ${totalCost}`);

  // Topping COGS investigation
  console.log(`\n=== Topping COGS investigation ===`);
  const linesWithModifiers = (lines as any[]).filter(l => {
    try {
      const mods = JSON.parse(l.modifiers_snapshot_json || "[]");
      return Array.isArray(mods) && mods.length > 0;
    } catch { return false; }
  });
  console.log(`Lines with modifiers: ${linesWithModifiers.length}`);

  // Check recipe_snapshot_json for these lines
  let hasVariantRecipe = 0;
  let hasModifierRecipe = 0;
  for (const l of linesWithModifiers.slice(0, 100)) {
    try {
      const recipe = JSON.parse(l.recipe_snapshot_json || "{}");
      if (recipe.variant && recipe.variant.ingredients && recipe.variant.ingredients.length > 0) hasVariantRecipe++;
      if (recipe.modifiers && recipe.modifiers.length > 0) {
        const hasIng = recipe.modifiers.some((m: any) => m.recipe && m.recipe.ingredients && m.recipe.ingredients.length > 0);
        if (hasIng) hasModifierRecipe++;
      }
    } catch {}
  }
  console.log(`  Lines with variant ingredients in recipe snapshot: ${hasVariantRecipe}/100`);
  console.log(`  Lines with modifier ingredients in recipe snapshot: ${hasModifierRecipe}/100`);

  // Check what's in PnL allocator source for cost
  console.log(`\n=== Cost distribution check (first 5 lines with cost_at_sale > 0) ===`);
  const linesWithCost = (lines as any[]).filter(l => Number(l.cost_at_sale || 0) > 0).slice(0, 5);
  for (const l of linesWithCost) {
    const recipe = JSON.parse(l.recipe_snapshot_json || "{}");
    const variantIngCount = recipe.variant?.ingredients?.length || 0;
    const modifierIngCount = (recipe.modifiers || []).reduce((s: number, m: any) => s + (m.recipe?.ingredients?.length || 0), 0);
    console.log({
      line_id: l.id,
      cost_at_sale: l.cost_at_sale,
      variant_ingredients: variantIngCount,
      modifier_ingredients: modifierIngCount,
    });
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
