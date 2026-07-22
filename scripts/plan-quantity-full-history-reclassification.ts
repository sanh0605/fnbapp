import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only analysis for the "semi-product implicit-production gap" finding
 * from the full-history rebuild's Phase 2 report (item #1 the owner asked
 * to handle first). Builds the reclassification plan the SAME way every
 * prior correction in this project has: insert-only compensating entries
 * per (order, item) where the engine's ground truth disagrees with what is
 * currently recorded, never touching/deleting original rows.
 *
 * Per docs/operations/implicit-production-quantity-correction-playbook.md's
 * hard-learned rule (the Round 2 incident, 2026-07-21): always dry-run
 * against the FULL candidate set first, and check the blast radius before
 * ever applying. This script is that dry-run/blast-radius step -- no writes.
 *
 * Method: replayFullHistory's computedLedger is "what should be recorded"
 * per (order, item) for the exact same transaction-type family
 * (SALES_CONSUME/PRODUCTION_CONSUME/PRODUCTION_YIELD) that
 * isOrderInventoryLedger (lib/order-ledger-audit.ts) already treats as the
 * inventory-affecting set (also includes EDIT_REVERSAL/
 * RECLASSIFICATION_REVERSAL on the recorded side, since those are real
 * historical corrections that already happened and must stay counted).
 * Diffs the two per (order, item); anything beyond a small tolerance is a
 * candidate compensating entry.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
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

  const { rows: trustedPrimitives } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  const { computedLedger, errors } = replayFullHistory({ orders, lines, recipes, semiProducts, trustedPrimitives });
  console.log(`Replay errors: ${errors.length}`);

  // "Should be recorded" per (order, item) -- only the sale/production
  // consumption family this engine itself produces.
  const computedByOrderItem = new Map<string, number>();
  for (const row of computedLedger) {
    const key = `${row.reference_id}|${row.item_reference}`;
    computedByOrderItem.set(key, (computedByOrderItem.get(key) || 0) + row.quantity_change);
  }

  // "Is recorded" per (order, item) -- same inventory-affecting transaction
  // types lib/order-ledger-audit.ts already treats as authoritative for
  // this comparison (SALES_CONSUME/EDIT_REVERSAL/RECLASSIFICATION_REVERSAL/
  // PRODUCTION_CONSUME/PRODUCTION_YIELD).
  const RECORDED_TYPES = new Set(["SALES_CONSUME", "EDIT_REVERSAL", "RECLASSIFICATION_REVERSAL", "PRODUCTION_CONSUME", "PRODUCTION_YIELD"]);
  const recordedByOrderItem = new Map<string, number>();
  const orderById = new Map(orders.map((o: any) => [o.id, o]));
  for (const row of ledger as any[]) {
    if (!RECORDED_TYPES.has(row.transaction_type)) continue;
    const order = orderById.get(row.reference_id);
    if (!order || order.status !== "COMPLETED" || order.superseded_by) continue; // only live orders, matching replayFullHistory's own selection
    const key = `${row.reference_id}|${row.item_reference}`;
    recordedByOrderItem.set(key, (recordedByOrderItem.get(key) || 0) + (Number(row.quantity_change) || 0));
  }

  type Finding = { order_id: string; order_no: string; item: string; item_name: string; computed: number; recorded: number; delta: number };
  const findings: Finding[] = [];
  const allKeys = new Set([...computedByOrderItem.keys(), ...recordedByOrderItem.keys()]);
  for (const key of allKeys) {
    const computed = computedByOrderItem.get(key) || 0;
    const recorded = recordedByOrderItem.get(key) || 0;
    const delta = computed - recorded;
    if (Math.abs(delta) < 0.01) continue;
    const [orderId, item] = key.split("|");
    const order = orderById.get(orderId);
    findings.push({ order_id: orderId, order_no: order?.order_no || orderId, item, item_name: nameOf(item), computed, recorded, delta });
  }

  console.log(`\n=== BLAST RADIUS ===`);
  console.log(`Total (order, item) combinations with a difference: ${findings.length}`);
  const distinctOrders = new Set(findings.map(f => f.order_id));
  console.log(`Distinct orders affected: ${distinctOrders.size}`);

  const byItem = new Map<string, { count: number; netDelta: number }>();
  for (const f of findings) {
    const e = byItem.get(f.item_name) || { count: 0, netDelta: 0 };
    e.count++;
    e.netDelta += f.delta;
    byItem.set(f.item_name, e);
  }
  console.log(`\nBy item (${byItem.size} distinct items affected):`);
  const sortedItems = [...byItem.entries()].sort((a, b) => Math.abs(b[1].netDelta) - Math.abs(a[1].netDelta));
  for (const [item, e] of sortedItems.slice(0, 25)) {
    console.log(`  ${item}: ${e.count} (order,item) rows, net delta ${round(e.netDelta)}`);
  }

  // Cross-check: how many of the affected orders were already touched by
  // Round 1-3's known corrections (RECLASSIFY_2026-07-20 tag family)?
  const alreadyCorrectedOrderIds = new Set(
    (ledger as any[])
      .filter(r => String(r.source || "").includes("RECLASSIFY_2026-07-20"))
      .map(r => r.reference_id),
  );
  const overlapWithKnownCorrections = [...distinctOrders].filter(id => alreadyCorrectedOrderIds.has(id));
  console.log(`\nOf the ${distinctOrders.size} affected orders, ${overlapWithKnownCorrections.length} were already touched by Round 1-3's known correction (tag RECLASSIFY_2026-07-20).`);
  console.log(`New, previously-uncorrected orders in this finding: ${distinctOrders.size - overlapWithKnownCorrections.length}.`);

  // Sample a handful of findings for manual eyeballing.
  console.log(`\nSample findings (first 15, by absolute delta):`);
  const sorted = [...findings].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  for (const f of sorted.slice(0, 15)) {
    console.log(`  ${f.order_no} / ${f.item_name}: computed=${round(f.computed)} recorded=${round(f.recorded)} delta=${round(f.delta)}`);
  }

  console.log("\nNo data was written. This is analysis only.");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
