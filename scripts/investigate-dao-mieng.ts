/**
 * Investigate "đào miếng" COGS computation.
 * User says it shows 37đ/piece — way too low.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const [ingredients, units, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Units"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  // Find "đào miếng" ingredient
  const daoMieng = (ingredients as any[]).filter(i =>
    i.name && i.name.toLowerCase().includes("đào"),
  );
  console.log("=== 'Đào' base ingredients ===");
  for (const ing of daoMieng) {
    const unit = (units as any[]).find(u => u.id === ing.base_unit);
    console.log({
      id: ing.id,
      name: ing.name,
      base_unit: ing.base_unit,
      unit_name: unit?.name,
      is_non_inventory: ing.is_non_inventory,
    });

    // PO_RECEIPT entries
    const poReceipts = (ledger as any[]).filter(l =>
      l.item_reference === ing.id && l.transaction_type === "PO_RECEIPT",
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    console.log(`  PO_RECEIPTs: ${poReceipts.length}`);
    for (const p of poReceipts.slice(0, 5)) {
      console.log(`    ${p.created_at} | qty=${p.quantity_change} | unit_cost=${p.unit_cost}`);
    }

    // Total qty + cost
    const totalQty = poReceipts.reduce((s, p) => s + Number(p.quantity_change || 0), 0);
    const totalCost = poReceipts.reduce((s, p) => s + Number(p.unit_cost || 0) * Number(p.quantity_change || 0), 0);
    console.log(`  Total qty: ${totalQty}, total cost: ${totalCost}, MAC: ${totalQty > 0 ? totalCost / totalQty : 0}`);
  }

  // Find recipes using đào miếng
  console.log("\n=== Recipes using 'đào' ingredients ===");
  const daoIds = new Set(daoMieng.map(i => i.id));
  for (const r of recipes as any[]) {
    try {
      const ings = JSON.parse(r.ingredients_json || "[]");
      const hasDao = ings.some((i: any) => daoIds.has(i.ingredient_id));
      if (hasDao) {
        const target = r.target_type === "PRODUCT_VARIANT"
          ? (ingredients as any[]).find(p => p.id === r.target_id)?.name || r.target_id
          : (semiProducts as any[]).find(s => s.id === r.target_id)?.name || r.target_id;
        console.log(`Recipe ${r.target_type} ${target} (${r.target_id}):`);
        for (const ing of ings) {
          const ingName = (ingredients as any[]).find(i => i.id === ing.ingredient_id)?.name
            || (semiProducts as any[]).find(s => s.id === ing.ingredient_id)?.name
            || ing.ingredient_id;
          console.log(`  ${ing.ingredient_id} ${ingName}: qty=${ing.quantity}, type=${ing.ingredient_type}`);
        }
      }
    } catch {}
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
