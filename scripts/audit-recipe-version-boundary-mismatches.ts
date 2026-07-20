import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only, broad review requested 2026-07-20: before correcting any of the
 * 82 remaining BTP-shortfall orders, find every order across the FULL
 * dataset that is potentially affected by the same class of issue --
 * a semi-product recipe version whose declared start_date/end_date does not
 * match what the live system actually used at the moment of sale (because
 * the recipe change was entered into the system later than when it truly
 * took effect, or vice versa).
 *
 * For every semi-product with 2+ recipe versions, and every historical order
 * with a shortfall for that semi-product, this empirically determines which
 * recipe version the RECORDED raw-ingredient consumption ratio actually
 * matches, and compares that against which version selectEffectiveRecipe
 * (using order.created_at as asOf) would pick. A mismatch here means the
 * order's recorded quantity does not correspond to the version that was
 * "supposed" to be in effect per the recipe table's own dates -- exactly the
 * class of discrepancy already confirmed for UCK000388, PHD000959, and
 * UCK000461.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { selectEffectiveRecipe } = await import("../lib/recipe-selection");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");

  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  // Semi-products with 2+ recipe versions.
  const recipesBySemiProduct = new Map<string, any[]>();
  for (const r of recipes as any[]) {
    if (r.target_type !== "SEMI_PRODUCT") continue;
    const arr = recipesBySemiProduct.get(r.target_id) || [];
    arr.push(r);
    recipesBySemiProduct.set(r.target_id, arr);
  }
  const multiVersionSemiProducts = [...recipesBySemiProduct.entries()].filter(([, arr]) => arr.length >= 2);
  console.log(`Semi-products with 2+ recipe versions: ${multiVersionSemiProducts.length}`);
  for (const [spId, versions] of multiVersionSemiProducts) {
    const sp = (semiProducts as any[]).find(s => s.id === spId);
    console.log(`  ${spId} (${sp?.name}): ${versions.length} versions`);
    for (const v of versions.sort((a, b) => new Date(a.start_date || a.created_at || 0).getTime() - new Date(b.start_date || b.created_at || 0).getTime())) {
      console.log(`    start=${v.start_date || v.created_at} end=${v.end_date || "(open)"}`);
    }
  }

  const shortfallOrderIds = [...new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("BTP_SHORTFALL"))
      .map(r => r.reference_id),
  )];

  let checkedOrders = 0;
  let versionMismatchOrders = 0;
  const details: string[] = [];

  for (const orderId of shortfallOrderIds) {
    const order = (orders as any[]).find(o => o.id === orderId);
    if (!order) continue;
    const orderLines = linesByOrder.get(orderId) || [];

    const shortfallRows = (ledger as any[]).filter(
      r => r.reference_id === orderId && r.transaction_type === "SALES_CONSUME" && (r.source || "").includes("BTP_SHORTFALL"),
    );
    if (shortfallRows.length === 0) continue;

    // Group by the semi-product id embedded in the source tag.
    const bySemiProduct = new Map<string, any[]>();
    for (const row of shortfallRows) {
      const match = /BTP_SHORTFALL:([^:]+)/.exec(row.source || "");
      if (!match) continue;
      const spId = match[1];
      if (!recipesBySemiProduct.has(spId) || (recipesBySemiProduct.get(spId)?.length || 0) < 2) continue;
      const arr = bySemiProduct.get(spId) || [];
      arr.push(row);
      bySemiProduct.set(spId, arr);
    }

    for (const [spId, rows] of bySemiProduct) {
      checkedOrders++;
      const selected = selectEffectiveRecipe(recipes as any[], "SEMI_PRODUCT", spId, order.created_at);
      if (!selected) continue;
      let selectedIngredients: any[] = [];
      try {
        selectedIngredients = JSON.parse(selected.ingredients_json || "[]");
      } catch {
        continue;
      }

      // Find the recorded ratio between two ingredients in this shortfall
      // group (if there are at least 2 distinct ingredients) and see if it
      // matches the date-selected version's ratio, or some OTHER version's
      // ratio instead.
      const recordedByItem = new Map<string, number>();
      for (const row of rows) {
        recordedByItem.set(row.item_reference, (recordedByItem.get(row.item_reference) || 0) + Math.abs(Number(row.quantity_change)));
      }
      const items = [...recordedByItem.keys()];
      if (items.length < 2) continue;
      const [itemA, itemB] = items;
      const recordedRatio = recordedByItem.get(itemA)! / recordedByItem.get(itemB)!;

      const selectedIngA = selectedIngredients.find((i: any) => i.ingredient_id === itemA);
      const selectedIngB = selectedIngredients.find((i: any) => i.ingredient_id === itemB);
      if (!selectedIngA || !selectedIngB) continue;
      const selectedRatio = Number(selectedIngA.quantity) / Number(selectedIngB.quantity);

      if (Math.abs(recordedRatio - selectedRatio) / selectedRatio > 0.02) {
        // Recorded ratio doesn't match the date-selected version. Find which
        // version it DOES match, if any.
        const versions = recipesBySemiProduct.get(spId) || [];
        let matchedVersion: any = null;
        for (const v of versions) {
          try {
            const ings = JSON.parse(v.ingredients_json || "[]");
            const ingA = ings.find((i: any) => i.ingredient_id === itemA);
            const ingB = ings.find((i: any) => i.ingredient_id === itemB);
            if (!ingA || !ingB) continue;
            const ratio = Number(ingA.quantity) / Number(ingB.quantity);
            if (Math.abs(recordedRatio - ratio) / ratio < 0.02) {
              matchedVersion = v;
              break;
            }
          } catch {}
        }
        versionMismatchOrders++;
        details.push(
          `${order.order_no} (${order.created_at}) semi=${spId}: recorded ratio ${itemA}/${itemB}=${recordedRatio.toFixed(4)}, ` +
          `date-selected version (start=${selected.start_date || selected.created_at}) ratio=${selectedRatio.toFixed(4)}, ` +
          `matches version starting=${matchedVersion ? (matchedVersion.start_date || matchedVersion.created_at) : "NONE FOUND"}`,
        );
      }
    }
  }

  console.log(`\nShortfall-order-semiproduct pairs checked (multi-version semi-products only): ${checkedOrders}`);
  console.log(`Version-boundary mismatches found: ${versionMismatchOrders}`);
  console.log(`\nDetails:`);
  for (const d of details) console.log(`  ${d}`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
