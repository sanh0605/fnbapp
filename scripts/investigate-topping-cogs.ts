/**
 * Investigate topping COGS accuracy.
 * Current breakdownCOGSBySource splits cost_at_sale proportionally by qty.
 * But ingredient costs differ wildly (coffee base expensive, sugar cheap).
 *
 * Compare:
 * 1. Current proportional allocation
 * 2. Recomputed MAC per ingredient (accurate)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");
const { computeLineCostAtSale } = require("../lib/order-cogs");
const { parseLineRecipeSnapshot } = require("../lib/order-types");

async function main() {
  const [orders, lines, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const filteredOrders = orders.filter((o: any) => {
    if (o.status !== "COMPLETED") return false;
    if (o.superseded_by) return false;
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d >= new Date("2026-06-01") && d <= new Date("2026-06-19T23:59:59");
  });
  const orderIds = new Set(filteredOrders.map((o: any) => o.id));
  const filteredLines = lines.filter((l: any) => orderIds.has(l.order_id));

  // Find lines with modifiers
  const linesWithMods = filteredLines.filter((l: any) => {
    const mods = JSON.parse(l.modifiers_snapshot_json || "[]");
    return mods.length > 0;
  });
  console.log(`Lines with modifiers in range: ${linesWithMods.length}\n`);

  // For each, compare:
  // - stored line.cost_at_sale
  // - computed variant-only MAC
  // - computed modifier-only MAC
  // - sum should match
  console.log("Sample lines (first 10):");
  console.log("order_no | stored_cost | variant_mac | modifier_mac | sum | match?\n");
  let totalStored = 0;
  let totalVariant = 0;
  let totalModifier = 0;
  let mismatches = 0;
  for (const l of linesWithMods.slice(0, 50)) {
    const recipe = parseLineRecipeSnapshot(l.recipe_snapshot_json);
    const storedCost = Number(l.cost_at_sale || 0);
    const order = filteredOrders.find((o: any) => o.id === l.order_id);
    const saleTime = order?.created_at || new Date().toISOString();

    // Variant-only MAC
    const variantRecipe = { variant: recipe.variant, modifiers: [] };
    const variantMAC = computeLineCostAtSale(variantRecipe, ledger, Number(l.qty), saleTime);

    // Modifier-only MAC (sum each modifier)
    let modifierMAC = 0;
    for (const modEntry of recipe.modifiers) {
      const modOnlyRecipe = {
        variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
        modifiers: [modEntry],
      };
      modifierMAC += computeLineCostAtSale(modOnlyRecipe, ledger, Number(l.qty), saleTime);
    }

    totalStored += storedCost;
    totalVariant += variantMAC;
    totalModifier += modifierMAC;
    const sum = variantMAC + modifierMAC;
    if (Math.abs(sum - storedCost) > 1) mismatches++;
    if (linesWithMods.indexOf(l) < 10) {
      console.log(`${order?.order_no} | ${storedCost} | ${variantMAC} | ${modifierMAC} | ${sum} | ${Math.abs(sum - storedCost) <= 1 ? "✓" : "✗"}`);
    }
  }

  console.log(`\n=== Aggregate across ${linesWithMods.length} lines ===`);
  console.log(`Total stored cost_at_sale: ${totalStored}đ`);
  console.log(`Total variant MAC:         ${totalVariant}đ`);
  console.log(`Total modifier MAC:        ${totalModifier}đ`);
  console.log(`Sum (variant+modifier):    ${totalVariant + totalModifier}đ`);
  console.log(`Mismatches: ${mismatches}/${linesWithMods.length}`);

  // Per-topping accurate COGS
  console.log(`\n=== Per-topping accurate COGS (MAC-based) ===`);
  const cogsByMod = new Map<string, { name: string; cogs: number }>();
  for (const l of linesWithMods) {
    const recipe = parseLineRecipeSnapshot(l.recipe_snapshot_json);
    const order = filteredOrders.find((o: any) => o.id === l.order_id);
    const saleTime = order?.created_at || new Date().toISOString();
    for (const modEntry of recipe.modifiers) {
      const modOnlyRecipe = {
        variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
        modifiers: [modEntry],
      };
      const cost = computeLineCostAtSale(modOnlyRecipe, ledger, Number(l.qty), saleTime);
      const id = modEntry.modifier_id;
      if (!cogsByMod.has(id)) cogsByMod.set(id, { name: modEntry.modifier_name, cogs: 0 });
      cogsByMod.get(id).cogs += cost;
    }
  }
  for (const [id, info] of cogsByMod) {
    console.log(`  ${info.name}: ${info.cogs}đ`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
