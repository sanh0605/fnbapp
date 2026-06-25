import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 4.4 — Classify negative stock periods by likely cause.
 *
 * For each item with a negative period, inspect ledger to categorize:
 *   - MISSING_PO: consumed before any PO_RECEIPT (or PO insufficient)
 *   - DOUBLE_DEDUCT: same order ledger written twice (SALES_CONSUME duplicated)
 *   - RECIPE_WRONG: ingredient used is recipe-only, no production yield
 *   - MIGRATION_GAP: orders migrated without corresponding historical ledger
 *
 * Also flags items that affect COGS (used in any recipe).
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [ledger, baseIngredients, semiProducts, recipes] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Recipes"),
  ]);

  // Items used in any recipe → affect COGS
  const cogsAffectingItems = new Set<string>();
  for (const recipe of recipes as any[]) {
    try {
      const ings = JSON.parse(recipe.ingredients_json || "[]");
      for (const ing of ings) cogsAffectingItems.add(ing.ingredient_id);
    } catch {}
  }

  // Build running balance by item, find negative periods
  const ledgerByItem = new Map<string, any[]>();
  for (const row of ledger as any[]) {
    const rows = ledgerByItem.get(row.item_reference) || [];
    rows.push(row);
    ledgerByItem.set(row.item_reference, rows);
  }

  const allItems = [
    ...(baseIngredients as any[]).map(b => ({ id: b.id, name: b.name, type: "BASE_INGREDIENT", unit: b.base_unit, nonInv: b.is_non_inventory === "TRUE" || b.is_non_inventory === true })),
    ...(semiProducts as any[]).map(s => ({ id: s.id, name: s.name, type: "SEMI_PRODUCT", unit: s.base_unit, nonInv: false })),
  ];

  const classifications: any[] = [];

  for (const item of allItems) {
    if (item.nonInv) continue;
    const rows = (ledgerByItem.get(item.id) || []).slice().sort((a, b) =>
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
    );

    let balance = 0;
    let inNegative = false;
    let negStart: any = null;
    let minBalance = 0;
    let totalConsume = 0;
    let totalReceipt = 0;
    let consumeBeforeReceipt = 0;

    for (const row of rows) {
      const qty = Number(row.quantity_change || 0);
      const before = balance;
      balance += qty;
      if (qty > 0) totalReceipt += qty;
      if (qty < 0) {
        totalConsume += Math.abs(qty);
        if (totalReceipt === 0) consumeBeforeReceipt += Math.abs(qty);
      }
      if (balance < -0.0001 && !inNegative) {
        inNegative = true;
        negStart = { row, before };
        minBalance = balance;
      } else if (inNegative) {
        minBalance = Math.min(minBalance, balance);
        if (balance >= -0.0001) {
          classifications.push({
            item,
            start: negStart.row.created_at,
            end: row.created_at,
            startRef: negStart.row.reference_id,
            endRef: row.reference_id,
            minBalance,
            totalConsume,
            totalReceipt,
            consumeBeforeReceipt,
          });
          inNegative = false;
        }
      }
    }
    if (inNegative) {
      classifications.push({
        item,
        start: negStart.row.created_at,
        end: "(ongoing)",
        startRef: negStart.row.reference_id,
        endRef: "",
        minBalance,
        totalConsume,
        totalReceipt,
        consumeBeforeReceipt,
      });
    }
  }

  // Classify cause
  for (const c of classifications) {
    if (c.item.type === "SEMI_PRODUCT") {
      // SP without production-yield ledger entries → recipe-only / migration gap
      const hasYield = (ledgerByItem.get(c.item.id) || []).some(r => r.transaction_type === "PRODUCTION_YIELD");
      c.cause = hasYield ? "DOUBLE_DEDUCT_OR_RECIPE" : "MIGRATION_GAP_NO_YIELD";
    } else {
      c.cause = c.consumeBeforeReceipt > 0 ? "MISSING_PO" : "DOUBLE_DEDUCT_OR_RECIPE";
    }
    c.affectsCogs = cogsAffectingItems.has(c.item.id);
  }

  console.log("=== NEGATIVE PERIOD CLASSIFICATION ===");
  console.log(`Total negative periods: ${classifications.length}`);
  console.log(`Items affecting COGS:   ${classifications.filter(c => c.affectsCogs).length}`);

  const byCause = new Map<string, number>();
  for (const c of classifications) byCause.set(c.cause, (byCause.get(c.cause) || 0) + 1);
  console.log("\nBy cause:");
  for (const [cause, count] of byCause.entries()) console.log(`  ${cause}: ${count}`);

  console.log("\nDetail:");
  for (const c of classifications) {
    const cogs = c.affectsCogs ? " [COGS]" : "";
    console.log(`\n${c.item.id} | ${c.item.name} | ${c.item.type}${cogs}`);
    console.log(`  cause=${c.cause}`);
    console.log(`  period: ${c.start} → ${c.end}`);
    console.log(`  min balance: ${c.minBalance}`);
    console.log(`  total consume: ${c.totalConsume}, total receipt: ${c.totalReceipt}, before receipt: ${c.consumeBeforeReceipt}`);
    console.log(`  start ref: ${c.startRef}`);
  }

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
