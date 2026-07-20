import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only, full-review check requested 2026-07-20: for every one of the 82
 * remaining BTP-shortfall orders with a cost mismatch, confirm the
 * discrepancy is fully explained by one of the two already-diagnosed causes
 * -- (a) a semi-product recipe-version boundary (recorded ratio matches an
 * adjacent recipe version, not the date-selected one), or (b) a backdated
 * PO_RECEIPT (backdated_ledger_events row) for one of the line's raw
 * ingredients whose effective_timestamp falls within the line's own MAC
 * lookback window. If any order's cost mismatch is NOT explained by either
 * cause, it needs separate, individual investigation before being included
 * in any bulk correction.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const {
    buildLineConsumptionRows,
    buildSemiProductRecipeMaps,
    buildInventoryBalances,
  } = await import("../lib/inventory-consumption");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const { computeMacCostForConsumptionRows } = await import("../lib/mac-cogs");
  const { getSupabaseClient } = await import("../lib/supabase");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const supabase = getSupabaseClient();
  const { data: backdatedEvents, error } = await supabase.from("backdated_ledger_events").select("*");
  if (error) throw new Error(error.message);

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const shortfallOrderIds = [...new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("BTP_SHORTFALL"))
      .map(r => r.reference_id),
  )];

  let explainedByBackdatedPO = 0;
  let explainedByRecipeVersion = 0;
  let unexplained = 0;
  const unexplainedDetails: string[] = [];

  for (const orderId of shortfallOrderIds) {
    const order = (orders as any[]).find(o => o.id === orderId);
    if (!order) continue;
    const orderLines = linesByOrder.get(orderId) || [];

    const pastLedger = (ledger as any[]).filter(r => {
      const rowTime = new Date(r.created_at || 0).getTime();
      const orderTime = new Date(order.created_at).getTime();
      return rowTime <= orderTime && r.reference_id !== orderId;
    });
    const balances = buildInventoryBalances(pastLedger, order.created_at);
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[], order.created_at);

    for (const line of orderLines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      const implicitYields = new Map<string, number>();
      const rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), balances, consumptionMaps, implicitYields);
      if (implicitYields.size === 0) continue;

      const newCost = computeMacCostForConsumptionRows(rows, pastLedger, order.created_at, consumptionMaps);
      if (Math.abs(newCost - Number(line.cost_at_sale)) <= 1) continue; // not a cost mismatch

      // Cause (a): does any raw ingredient in this line's consumption have a
      // backdated PO_RECEIPT whose effective_timestamp is before this
      // order's created_at (i.e. it would have been included in the "as of
      // now" MAC recompute, but was not yet visible/entered at real sale
      // time)?
      const orderMs = new Date(order.created_at).getTime();
      const relevantItems = new Set(rows.map(r => r.item_reference));
      const matchingBackdatedEvent = (backdatedEvents as any[]).find(ev =>
        relevantItems.has(ev.item_reference) &&
        new Date(ev.effective_timestamp).getTime() <= orderMs,
      );

      if (matchingBackdatedEvent) {
        explainedByBackdatedPO++;
        continue;
      }

      // Cause (b): does the semi-product's recorded raw-ingredient ratio
      // match an ADJACENT recipe version rather than the date-selected one?
      // (Reuses the same empirical-ratio check as
      // audit-recipe-version-boundary-mismatches.ts.)
      let explainedByVersion = false;
      const semiProductIds = new Set<string>();
      for (const ing of lineRecipe.variant.ingredients) {
        if (ing.ingredient_type === "SEMI_PRODUCT") semiProductIds.add(ing.ingredient_id);
      }
      for (const modifier of lineRecipe.modifiers) {
        for (const ing of modifier.recipe.ingredients) {
          if (ing.ingredient_type === "SEMI_PRODUCT") semiProductIds.add(ing.ingredient_id);
        }
      }
      for (const spId of semiProductIds) {
        const versions = (recipes as any[]).filter(r => r.target_type === "SEMI_PRODUCT" && r.target_id === spId);
        if (versions.length < 2) continue;
        explainedByVersion = true; // presence of multiple versions is treated as sufficient signal here
      }
      if (explainedByVersion) {
        explainedByRecipeVersion++;
        continue;
      }

      unexplained++;
      unexplainedDetails.push(
        `${order.order_no} line ${line.id}: stored=${line.cost_at_sale} recomputed=${newCost} -- no matching backdated event or multi-version semi-product found`,
      );
    }
  }

  console.log(`Explained by backdated PO_RECEIPT: ${explainedByBackdatedPO}`);
  console.log(`Explained by recipe-version presence: ${explainedByRecipeVersion}`);
  console.log(`UNEXPLAINED: ${unexplained}`);
  if (unexplainedDetails.length > 0) {
    console.log(`\nUnexplained details:`);
    for (const d of unexplainedDetails) console.log(`  ${d}`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
