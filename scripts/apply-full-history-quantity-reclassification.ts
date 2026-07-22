import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Item #1 quantity reclassification, per-order (owner explicitly chose this
 * over the safer aggregate-only correction, after being told the risk:
 * same class as the 2026-07-21 Round 2 incident, and cannot be 100%
 * accurate since historical Production Order logging was incomplete --
 * this is the engine's best reconstruction, not a verified fact).
 *
 * Same insert-only compensating-entry pattern as every prior quantity
 * correction in this project (Round 1-3, apply-fix-double-reversal-bug.ts,
 * etc.): never deletes or modifies an existing Stock_Ledger row. For every
 * (order, item) where lib/full-history-recompute.ts's ground-truth replay
 * disagrees with the currently recorded inventory-affecting total, inserts
 * one compensating row with quantity_change = the exact difference, tagged
 * "FULLHISTORY_RECLASSIFY_2026-07-22" for a clean, fully reversible audit
 * trail (same tag-based rollback approach used for Round 2's own
 * rollback). Matches Round 1-3's own type convention: semi-product entries
 * (correcting a wrongly-recorded direct debit) use RECLASSIFICATION_REVERSAL;
 * base-ingredient entries (the raw consumption that should have been
 * recorded) use PRODUCTION_CONSUME.
 *
 * unit_cost is left at 0 on these entries (matching Round 1-3's pattern --
 * quantity-only reclassification; cost_at_sale itself was already
 * recomputed system-wide in Phase 4 using this same engine, so no separate
 * cost follow-up is expected to be needed).
 *
 * Dry-run by default; --apply writes for real.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, insertMany } = await import("../lib/sheets_db");
  const { buildTrustedPrimitiveLedger, replayFullHistory } = await import("../lib/full-history-recompute");

  console.log("Loading data...");
  const [orders, lines, ledger, recipes, semiProducts, purchaseOrders, purchaseOrderLines, purchasedItems, conversions, baseIngredients] =
    await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAllNoCache("Stock_Ledger"),
      findAllNoCache("Recipes"),
      findAllNoCache("Semi_Products"),
      findAllNoCache("Purchase_Orders"),
      findAllNoCache("Purchase_Order_Lines"),
      findAllNoCache("Purchased_Items"),
      findAllNoCache("UOM_Conversions"),
      findAllNoCache("Base_Ingredients"),
    ]) as any[][];

  const nameById = new Map<string, string>();
  for (const i of baseIngredients) nameById.set(i.id, i.name);
  for (const s of semiProducts) nameById.set(s.id, s.name);
  const nameOf = (id: string) => nameById.get(id) || id;
  const orderById = new Map(orders.map((o: any) => [o.id, o]));
  const semiProductIds = new Set((semiProducts as any[]).map(s => s.id));

  const { rows: trustedPrimitives } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  const { computedLedger, errors } = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives });
  if (errors.length > 0) console.log(`Replay errors (excluded from correction): ${errors.length}`);

  const computedByOrderItem = new Map<string, number>();
  for (const row of computedLedger) {
    const key = `${row.reference_id}|${row.item_reference}`;
    computedByOrderItem.set(key, (computedByOrderItem.get(key) || 0) + row.quantity_change);
  }

  const RECORDED_TYPES = new Set(["SALES_CONSUME", "EDIT_REVERSAL", "RECLASSIFICATION_REVERSAL", "PRODUCTION_CONSUME", "PRODUCTION_YIELD"]);
  const recordedByOrderItem = new Map<string, number>();
  for (const row of ledger as any[]) {
    if (!RECORDED_TYPES.has(row.transaction_type)) continue;
    const order = orderById.get(row.reference_id);
    if (!order || order.status !== "COMPLETED" || order.superseded_by) continue;
    const key = `${row.reference_id}|${row.item_reference}`;
    recordedByOrderItem.set(key, (recordedByOrderItem.get(key) || 0) + (Number(row.quantity_change) || 0));
  }

  type PlannedRow = {
    id: string;
    transaction_type: "RECLASSIFICATION_REVERSAL" | "PRODUCTION_CONSUME";
    reference_id: string;
    item_reference: string;
    quantity_change: string;
    unit_cost: string;
    created_at: string;
    source: string;
  };
  const planned: PlannedRow[] = [];
  const allKeys = new Set([...computedByOrderItem.keys(), ...recordedByOrderItem.keys()]);
  let seq = 0;
  for (const key of allKeys) {
    const computed = computedByOrderItem.get(key) || 0;
    const recorded = recordedByOrderItem.get(key) || 0;
    const delta = computed - recorded;
    if (Math.abs(delta) < 0.01) continue;
    const [orderId, item] = key.split("|");
    const order = orderById.get(orderId);
    if (!order) continue;
    planned.push({
      id: `RECLASS-FH-${Date.now()}-${seq++}`,
      transaction_type: semiProductIds.has(item) ? "RECLASSIFICATION_REVERSAL" : "PRODUCTION_CONSUME",
      reference_id: orderId,
      item_reference: item,
      quantity_change: String(delta),
      unit_cost: "0",
      created_at: order.created_at,
      source: "FULLHISTORY_RECLASSIFY_2026-07-22",
    });
  }

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Planned compensating entries: ${planned.length}`);
  console.log(`Distinct orders: ${new Set(planned.map(p => p.reference_id)).size}`);
  console.log(`By type: RECLASSIFICATION_REVERSAL=${planned.filter(p => p.transaction_type === "RECLASSIFICATION_REVERSAL").length}, PRODUCTION_CONSUME=${planned.filter(p => p.transaction_type === "PRODUCTION_CONSUME").length}`);

  const byItem = new Map<string, { count: number; netDelta: number }>();
  for (const p of planned) {
    const e = byItem.get(p.item_reference) || { count: 0, netDelta: 0 };
    e.count++;
    e.netDelta += Number(p.quantity_change);
    byItem.set(p.item_reference, e);
  }
  console.log(`\nBy item:`);
  for (const [item, e] of [...byItem.entries()].sort((a, b) => Math.abs(b[1].netDelta) - Math.abs(a[1].netDelta))) {
    console.log(`  ${nameOf(item)}: ${e.count} entries, net ${Math.round(e.netDelta * 100) / 100}`);
  }

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  const batchSize = 500;
  for (let i = 0; i < planned.length; i += batchSize) {
    const batch = planned.slice(i, i + batchSize);
    await insertMany("Stock_Ledger", batch);
    console.log(`  Inserted ${Math.min(i + batchSize, planned.length)} / ${planned.length}`);
  }

  console.log(`\nApplied: ${planned.length} compensating entries written.`);
  console.log(`Rollback: delete all Stock_Ledger rows with source = "FULLHISTORY_RECLASSIFY_2026-07-22" to fully undo.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
