import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const START = "2026-05-31T17:00:00.000Z";
const END = "2026-06-25T16:59:59.999Z";

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

  const activeOrders = (orders as any[]).filter(o => {
    if (o.status !== "COMPLETED" || o.superseded_by) return false;
    const t = new Date(o.created_at || 0).getTime();
    return t >= new Date(START).getTime() && t <= new Date(END).getTime();
  });
  const orderById = new Map(activeOrders.map(o => [o.id, o]));
  const activeLines = (lines as any[]).filter(l => orderById.has(l.order_id));
  const sortedLines = [...activeLines].sort((a, b) => {
    const ta = new Date(orderById.get(a.order_id)?.created_at || 0).getTime();
    const tb = new Date(orderById.get(b.order_id)?.created_at || 0).getTime();
    return ta - tb;
  });

  const spRecipes = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT");
  const spYields = new Map<string, number>();
  for (const sp of semiProducts as any[]) spYields.set(sp.id, Number(sp.batch_yield) || 1);
  const spContext = { recipes: spRecipes, yields: spYields };

  // Find MOD-004 ingredient(s)
  const mod004Lines = sortedLines.filter(l => {
    const recipe = parseLineRecipeSnapshot(l.recipe_snapshot_json || "{}");
    return recipe.modifiers.some(m => m.modifier_id === "MOD-004");
  });

  console.log(`Lines with MOD-004 in range: ${mod004Lines.length}`);

  // Print first 5 MOD-004 lines' recipes and run both buggy + fixed for them
  const sample = mod004Lines.slice(0, 5);
  console.log("\n=== MOD-004 sample lines ===\n");

  for (const line of sample) {
    const order = orderById.get(line.order_id);
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
    const mod004Entry = recipe.modifiers.find(m => m.modifier_id === "MOD-004");
    console.log(`${order?.order_no} | line=${line.id} | qty=${line.qty} | cost_at_sale=${line.cost_at_sale}`);
    console.log(`  MOD-004 ingredients:`);
    for (const ing of mod004Entry?.recipe.ingredients || []) {
      console.log(`    ing=${ing.ingredient_id} type=${ing.ingredient_type} qty=${ing.quantity}`);
    }
  }

  // Two passes (buggy vs fixed) just for the sample, but tracking state needs full flow up to sample.
  function runPass(label: string, ledgerToUse: any[]) {
    console.log(`\n=== ${label} ===`);
    const tracker = new FIFOTracker();
    tracker.init(ledgerToUse);
    const sampleIds = new Set(sample.map(l => l.id));

    let mod004Total = 0;
    for (const line of sortedLines) {
      const r = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
      const qty = Number(line.qty) || 0;
      const variantOnly = { variant: r.variant, modifiers: [] };
      const v = computeLineCostFIFO(variantOnly as any, tracker, qty, spContext);
      let mod004cogs = 0;
      let modTotal = 0;
      for (const mod of r.modifiers) {
        const monly = {
          variant: { target_type: "PRODUCT_VARIANT" as const, target_id: "", ingredients: [] as any[] },
          modifiers: [mod],
        };
        const c = computeLineCostFIFO(monly as any, tracker, qty, spContext);
        modTotal += c;
        if (mod.modifier_id === "MOD-004") mod004cogs = c;
      }
      if (sampleIds.has(line.id)) {
        const order = orderById.get(line.order_id);
        console.log(`  ${order?.order_no} | rawVariant=${v} rawMod004=${mod004cogs} rawTotal=${v + modTotal} | cost_at_sale=${line.cost_at_sale}`);
      }
      // Aggregate scaled like the real function
      const rawTotal = v + modTotal;
      if (rawTotal > 0) {
        const scale = (Number(line.cost_at_sale) || rawTotal) / rawTotal;
        mod004Total += Math.round(mod004cogs * scale);
      }
    }
    console.log(`  MOD-004 total (scaled): ${mod004Total}`);
  }

  runPass("BUGGY (full ledger)", ledger as any[]);
  runPass(
    "FIXED (filtered ledger)",
    (ledger as any[]).filter(e => e.transaction_type !== "SALES_CONSUME" && e.transaction_type !== "EDIT_REVERSAL"),
  );
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
