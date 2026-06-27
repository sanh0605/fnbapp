/**
 * Diagnostic: investigate 101 MAC drift mismatches.
 *
 * Hypothesis: mismatches are caused by either:
 * (A) Recipe changes between sale time and now (BTP_SHORTFALL class).
 * (B) PO_RECEIPT entries added after Codex baseline (2026-06-26 15:37)
 *     with different unit_cost affecting historical MAC.
 * (C) BTP shortfall algorithm difference between store path and audit path.
 *
 * Claude code — investigation, read-only.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { auditMacCogsDrift } = await import("../lib/mac-cogs-audit");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  console.log("=== MAC DRIFT ROOT CAUSE INVESTIGATION ===\n");

  const drift = auditMacCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });

  console.log("Mismatched lines:", drift.lineMismatches.length);
  console.log("Total delta:", drift.totalDelta, "VND");
  console.log("Classification:", JSON.stringify(drift.classificationCounts));

  // Group by order created_at date.
  const orderByLine = new Map<string, any>();
  for (const o of orders as any[]) {
    for (const l of lines as any[]) {
      if (l.order_id === o.id) {
        orderByLine.set(l.id, o);
      }
    }
  }

  const byDate = new Map<string, number>();
  for (const m of drift.lineMismatches) {
    const o = orderByLine.get(m.line_id);
    if (!o) continue;
    const d = new Date(o.created_at).toISOString().substring(0, 10);
    byDate.set(d, (byDate.get(d) || 0) + 1);
  }

  console.log("\nMismatched lines by order date:");
  const sortedDates = Array.from(byDate.entries()).sort();
  for (const [date, count] of sortedDates) {
    console.log(`  ${date}: ${count} lines`);
  }

  // Group by classification + product.
  const byProduct = new Map<string, { class: string; count: number; delta: number }>();
  for (const m of drift.lineMismatches) {
    const key = `${m.classification}__${m.product_id}`;
    const existing = byProduct.get(key) || { class: m.classification, count: 0, delta: 0 };
    existing.count += 1;
    existing.delta += m.delta;
    byProduct.set(key, existing);
  }
  console.log("\nMismatched by classification + product:");
  const sortedProducts = Array.from(byProduct.entries()).sort((a, b) => b[1].count - a[1].count);
  for (const [key, v] of sortedProducts.slice(0, 15)) {
    console.log(`  ${key}: ${v.count} lines, total delta=${v.delta} VND`);
  }

  // Check BTP_SHORTFALL specific — find which BTP each line consumed.
  const btpCount = new Map<string, number>();
  for (const m of drift.lineMismatches) {
    if (m.classification !== "BTP_SHORTFALL") continue;
    const line = (lines as any[]).find(l => l.id === m.line_id);
    if (!line) continue;
    try {
      const recipe = JSON.parse(line.recipe_snapshot_json || "{}");
      const ings = recipe.ingredients || [];
      for (const ing of ings) {
        if (ing.ingredient_type === "SEMI_PRODUCT" || (ing.ingredient_id || "").startsWith("BTP-")) {
          btpCount.set(ing.ingredient_id, (btpCount.get(ing.ingredient_id) || 0) + 1);
        }
      }
    } catch {}
  }
  console.log("\nBTP_SHORTFALL — BTP items consumed in mismatched lines:");
  for (const [btp, count] of Array.from(btpCount.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${btp}: ${count} lines`);
  }

  // Check 5 specific mismatches in detail.
  console.log("\n=== Sample detail (top 5 mismatches) ===");
  for (const m of drift.lineMismatches.slice(0, 5)) {
    const o = orderByLine.get(m.line_id);
    const line = (lines as any[]).find(l => l.id === m.line_id);
    console.log(`\n  order=${m.order_no} | line=${m.line_id.substring(0, 8)}...`);
    console.log(`    order.created_at=${o?.created_at}`);
    console.log(`    line.product_id=${m.product_id} | variant=${m.variant_id}`);
    console.log(`    stored=${m.stored_cost} VND | recomputed=${m.expected_cost} VND | delta=${m.delta} VND`);
    console.log(`    classification=${m.classification}`);
    if (line) {
      try {
        const recipe = JSON.parse(line.recipe_snapshot_json || "{}");
        console.log(`    recipe_snapshot ingredients:`);
        for (const ing of (recipe.ingredients || []).slice(0, 5)) {
          console.log(`      ${ing.ingredient_type} ${ing.ingredient_id} qty=${ing.quantity} unit=${ing.unit_id}`);
        }
      } catch {
        console.log(`    recipe_snapshot: malformed`);
      }
    }
  }

  // Check ledger for these BTPs — are there entries AFTER sale time?
  console.log("\n=== BTP ledger entries after Codex baseline (2026-06-26 15:37) ===");
  const baseline = new Date("2026-06-26T08:37:00.000Z"); // 15:37 +0700 = 08:37 UTC
  for (const btp of Array.from(btpCount.keys()).slice(0, 3)) {
    const btpLedger = (ledger as any[])
      .filter(r => r.item_reference === btp)
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const afterBaseline = btpLedger.filter(r => new Date(r.created_at || 0).getTime() > baseline.getTime());
    console.log(`\n  ${btp}: ${btpLedger.length} total entries, ${afterBaseline.length} after baseline`);
    for (const r of afterBaseline.slice(0, 5)) {
      console.log(`    ${r.created_at} | ${r.transaction_type} | qty=${r.quantity_change} | unit_cost=${r.unit_cost || 0} | ref=${r.reference_id}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
