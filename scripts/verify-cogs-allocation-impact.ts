import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const START = "2026-05-31T17:00:00.000Z";
const END = "2026-06-25T16:59:59.999Z";

/**
 * Compare COGS allocation across all products/modifiers BEFORE and AFTER the ledger-filter fix.
 *
 * Method:
 *   - Replicate breakdownCOGSBySource logic with FULL ledger (buggy) and FILTERED ledger (fixed).
 *   - Aggregate variant + modifier COGS per row.
 *   - Report every row whose COGS differs between the two runs.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { FIFOTracker } = await import("../lib/fifo-tracker");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const { computeLineCostFIFO } = await import("../lib/order-cogs-fifo");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]);

  const activeOrders = (orders as any[]).filter(order => {
    if (order.status !== "COMPLETED" || order.superseded_by) return false;
    const t = new Date(order.created_at || 0).getTime();
    return t >= new Date(START).getTime() && t <= new Date(END).getTime();
  });
  const orderById = new Map(activeOrders.map(o => [o.id, o]));
  const activeLines = (lines as any[]).filter(l => orderById.has(l.order_id));

  const spRecipes = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT");
  const spYields = new Map<string, number>();
  for (const sp of semiProducts as any[]) spYields.set(sp.id, Number(sp.batch_yield) || 1);
  const spContext = { recipes: spRecipes, yields: spYields };

  const sortedLines = [...activeLines].sort((a, b) => {
    const ta = new Date(orderById.get(a.order_id)?.created_at || 0).getTime();
    const tb = new Date(orderById.get(b.order_id)?.created_at || 0).getTime();
    return ta - tb;
  });

  function allocate(ledgerToUse: any[]) {
    const tracker = new FIFOTracker();
    tracker.init(ledgerToUse);
    const variantMap = new Map<string, number>();
    const modifierMap = new Map<string, number>();

    for (const line of sortedLines) {
      const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
      const qty = Number(line.qty) || 0;
      const variantOnly = { variant: recipe.variant, modifiers: [] };
      const variantCost = computeLineCostFIFO(variantOnly as any, tracker, qty, spContext);
      let modTotal = 0;
      const modCosts: { id: string; cogs: number }[] = [];
      for (const mod of recipe.modifiers) {
        const modifierOnly = {
          variant: { target_type: "PRODUCT_VARIANT" as const, target_id: "", ingredients: [] as any[] },
          modifiers: [mod],
        };
        const c = computeLineCostFIFO(modifierOnly as any, tracker, qty, spContext);
        modCosts.push({ id: mod.modifier_id, cogs: c });
        modTotal += c;
      }
      const rawTotal = variantCost + modTotal;
      const targetTotal = Number(line.cost_at_sale) || rawTotal;
      if (rawTotal <= 0) {
        const key = `${line.product_id}__${line.variant_id}`;
        variantMap.set(key, (variantMap.get(key) || 0) + targetTotal);
        continue;
      }
      const scale = targetTotal / rawTotal;
      const vKey = `${line.product_id}__${line.variant_id}`;
      const scaledV = Math.round(variantCost * scale);
      variantMap.set(vKey, (variantMap.get(vKey) || 0) + scaledV);
      let allocated = scaledV;
      modCosts.forEach((m, idx) => {
        const isLast = idx === modCosts.length - 1;
        const scaled = isLast ? targetTotal - allocated : Math.round(m.cogs * scale);
        allocated += scaled;
        modifierMap.set(m.id, (modifierMap.get(m.id) || 0) + scaled);
      });
    }
    return { variantMap, modifierMap };
  }

  const buggy = allocate(ledger as any[]);
  const fixed = allocate(
    (ledger as any[]).filter(e => e.transaction_type !== "SALES_CONSUME" && e.transaction_type !== "EDIT_REVERSAL"),
  );

  const allVariantKeys = new Set([...buggy.variantMap.keys(), ...fixed.variantMap.keys()]);
  const allModKeys = new Set([...buggy.modifierMap.keys(), ...fixed.modifierMap.keys()]);

  console.log("=== COGS ALLOCATION IMPACT ANALYSIS ===");
  console.log(`Date range: ${START} → ${END}`);
  console.log(`Active orders: ${activeOrders.length}`);
  console.log(`Active lines: ${activeLines.length}\n`);

  const totalBuggyVariant = [...buggy.variantMap.values()].reduce((s, v) => s + v, 0);
  const totalFixedVariant = [...fixed.variantMap.values()].reduce((s, v) => s + v, 0);
  const totalBuggyMod = [...buggy.modifierMap.values()].reduce((s, v) => s + v, 0);
  const totalFixedMod = [...fixed.modifierMap.values()].reduce((s, v) => s + v, 0);

  console.log("=== TOTALS ===");
  console.log(`Variant total — buggy: ${totalBuggyVariant}, fixed: ${totalFixedVariant}, diff: ${totalFixedVariant - totalBuggyVariant}`);
  console.log(`Modifier total — buggy: ${totalBuggyMod}, fixed: ${totalFixedMod}, diff: ${totalFixedMod - totalBuggyMod}`);
  console.log(`Grand total — buggy: ${totalBuggyVariant + totalBuggyMod}, fixed: ${totalFixedVariant + totalFixedMod}\n`);

  console.log("=== VARIANT ROWS WITH DIFF ===");
  let variantDiffCount = 0;
  for (const key of allVariantKeys) {
    const b = buggy.variantMap.get(key) || 0;
    const f = fixed.variantMap.get(key) || 0;
    const diff = f - b;
    if (diff !== 0) {
      variantDiffCount++;
      console.log(`  ${key}: buggy=${b}, fixed=${f}, diff=${diff}`);
    }
  }
  console.log(`Total variant rows with diff: ${variantDiffCount}\n`);

  console.log("=== MODIFIER ROWS WITH DIFF ===");
  let modDiffCount = 0;
  for (const key of allModKeys) {
    const b = buggy.modifierMap.get(key) || 0;
    const f = fixed.modifierMap.get(key) || 0;
    const diff = f - b;
    if (diff !== 0) {
      modDiffCount++;
      console.log(`  ${key}: buggy=${b}, fixed=${f}, diff=${diff}`);
    }
  }
  console.log(`Total modifier rows with diff: ${modDiffCount}\n`);

  // Sample: show all modifier rows (regardless of diff) for context
  console.log("=== ALL MODIFIER ROWS (final values) ===");
  for (const key of allModKeys) {
    const f = fixed.modifierMap.get(key) || 0;
    console.log(`  ${key}: ${f}`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
