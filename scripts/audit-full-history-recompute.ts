import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 2 of the owner-approved full-history rebuild plan
 * (C:\Users\Admin\.claude\plans\toasty-mapping-hollerith.md). Read-only,
 * writes nothing. Runs lib/full-history-recompute.ts across the entire
 * order history and produces a full comparison report against currently
 * recorded data, for owner review (Phase 3) before any correction is
 * designed or applied (Phase 4).
 *
 * Sections:
 *  1. Cost (cost_at_sale): every mismatched line, split into 3 categories --
 *     A (unlocked, safe to review), B (locked and current, never touch),
 *     C (locked and stale -- lock's own recorded value no longer matches
 *     the line's current value, needs an explicit human call on what the
 *     lock should mean now). This 3-way split is the direct structural
 *     fix for the COGS-5 incident: lock status is an explicit, visible
 *     field on every finding, never something a later write step can
 *     silently ignore.
 *  2. Quantity: per raw ingredient, theoretical final balance (trusted
 *     primitives + this engine's own computed consumption, i.e. "if we
 *     trust only sales + recipes + real production + real purchases, what
 *     should be on hand right now") vs the currently recorded balance.
 *  3. PO_RECEIPT: re-derived landed cost (aggregated per purchase order +
 *     item, to correctly handle multi-line POs like supplier bonus/free
 *     quantity lines) vs currently stored.
 *  4. Production ledger consistency: production_items/production_orders
 *     (the operator-entered production record) vs the PRODUCTION_CONSUME/
 *     PRODUCTION_YIELD rows actually recorded in Stock_Ledger for the same
 *     production order.
 *
 * Output: console summary (real ingredient/product names) + a dated JSON
 * artifact under docs/audits/, matching the project's existing convention.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { buildTrustedPrimitiveLedger, replayFullHistory } = await import("../lib/full-history-recompute");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log("Loading data...");
  const [
    orders, lines, ledger, recipes, semiProducts,
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions,
    productionOrders, productionItems,
    baseIngredients,
  ] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("UOM_Conversions"),
    findAllNoCache("Production_Orders"),
    findAllNoCache("Production_Items"),
    findAllNoCache("Base_Ingredients"),
  ]) as any[][];

  const supabase = getSupabaseClient();
  const { data: locks, error: locksError } = await supabase
    .from("audit_baseline_locks")
    .select("order_line_id,locked_at,reason,stored_cost_at_sale,expected_cost_at_sale,delta_vnd");
  if (locksError) throw new Error(locksError.message);
  const lockByLineId = new Map((locks || []).map((l: any) => [l.order_line_id, l]));

  const nameById = new Map<string, string>();
  for (const i of baseIngredients) nameById.set(i.id, i.name);
  for (const s of semiProducts) nameById.set(s.id, s.name);
  const nameOf = (id: string) => nameById.get(id) || id;

  // ---- Run the recompute engine ----
  const { rows: trustedPrimitives, skippedPoReceipts } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  const { lineResults, computedLedger, errors } = replayFullHistory({
    orders, lines, recipes, semiProducts, trustedPrimitives,
  });

  console.log(`Replay: ${lineResults.length} lines, ${errors.length} errors, ${trustedPrimitives.length} trusted primitive rows, ${computedLedger.length} computed rows.`);
  if (skippedPoReceipts.length > 0) console.log(`Skipped PO receipts: ${skippedPoReceipts.length} (see JSON artifact).`);

  // ---- Section 1: cost, 3-way categorized ----
  type CostFinding = {
    order_no: string; line_id: string; sale_time: string;
    stored_cost_at_sale: number; computed_cost_at_sale: number; delta: number;
    category: "A_unlocked" | "B_locked_current" | "C_locked_stale";
    lock_reason?: string; lock_stored?: number; lock_expected?: number;
  };
  const costFindings: CostFinding[] = [];
  for (const r of lineResults) {
    const delta = r.computed_cost_at_sale - r.stored_cost_at_sale;
    if (Math.abs(delta) <= 1) continue;
    const lock = lockByLineId.get(r.line_id);
    let category: CostFinding["category"] = "A_unlocked";
    if (lock) {
      category = Number(lock.stored_cost_at_sale) === r.stored_cost_at_sale ? "B_locked_current" : "C_locked_stale";
    }
    costFindings.push({
      order_no: r.order_no, line_id: r.line_id, sale_time: r.sale_time,
      stored_cost_at_sale: r.stored_cost_at_sale, computed_cost_at_sale: r.computed_cost_at_sale, delta,
      category,
      lock_reason: lock?.reason, lock_stored: lock ? Number(lock.stored_cost_at_sale) : undefined,
      lock_expected: lock ? Number(lock.expected_cost_at_sale) : undefined,
    });
  }
  const catA = costFindings.filter(f => f.category === "A_unlocked");
  const catB = costFindings.filter(f => f.category === "B_locked_current");
  const catC = costFindings.filter(f => f.category === "C_locked_stale");

  console.log(`\n=== SECTION 1: COST (cost_at_sale) ===`);
  console.log(`Total mismatched lines: ${costFindings.length}`);
  console.log(`  Category A (unlocked, safe to review): ${catA.length} lines, net delta ${sum(catA.map(f => f.delta)).toLocaleString()} VND`);
  console.log(`  Category B (locked, current -- never touch): ${catB.length} lines, net delta ${sum(catB.map(f => f.delta)).toLocaleString()} VND`);
  console.log(`  Category C (locked, stale -- needs explicit human call): ${catC.length} lines, net delta ${sum(catC.map(f => f.delta)).toLocaleString()} VND`);
  if (catC.length > 0) {
    const byReason = groupCount(catC.map(f => f.lock_reason || "(unknown)"));
    console.log(`  Category C by lock reason:`, byReason);
  }

  // ---- Section 2: quantity, per raw ingredient theoretical vs recorded ----
  const theoreticalByItem = new Map<string, number>();
  for (const row of [...trustedPrimitives, ...computedLedger]) {
    theoreticalByItem.set(row.item_reference, (theoreticalByItem.get(row.item_reference) || 0) + row.quantity_change);
  }
  const recordedByItem = new Map<string, number>();
  for (const row of ledger as any[]) {
    const qty = Number(row.quantity_change) || 0;
    recordedByItem.set(row.item_reference, (recordedByItem.get(row.item_reference) || 0) + qty);
  }
  const allItemIds = new Set([...theoreticalByItem.keys(), ...recordedByItem.keys()]);
  type QtyFinding = { item: string; item_name: string; theoretical: number; recorded: number; delta: number };
  const qtyFindings: QtyFinding[] = [];
  for (const item of allItemIds) {
    const theoretical = theoreticalByItem.get(item) || 0;
    const recorded = recordedByItem.get(item) || 0;
    const delta = theoretical - recorded;
    if (Math.abs(delta) > 0.01) {
      qtyFindings.push({ item, item_name: nameOf(item), theoretical, recorded, delta });
    }
  }
  qtyFindings.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  console.log(`\n=== SECTION 2: QUANTITY (theoretical vs currently recorded, per item) ===`);
  console.log(`Items with a difference: ${qtyFindings.length} of ${allItemIds.size} total items touched`);
  console.log(`Top 15 by absolute difference:`);
  for (const f of qtyFindings.slice(0, 15)) {
    console.log(`  ${f.item_name} (${f.item}): theoretical=${round(f.theoretical)} recorded=${round(f.recorded)} delta=${round(f.delta)}`);
  }
  const negativeTheoretical = qtyFindings.filter(f => f.theoretical < -0.01);
  if (negativeTheoretical.length > 0) {
    console.log(`\n*** Items where the theoretical (ground-truth) balance is itself negative -- means more was sold than was ever purchased/produced, a real data gap, not a rounding issue: ${negativeTheoretical.length} ***`);
    for (const f of negativeTheoretical) {
      console.log(`  ${f.item_name} (${f.item}): theoretical=${round(f.theoretical)}`);
    }
  }

  // ---- Section 3: PO_RECEIPT, aggregated per PO+item ----
  type ReceiptAgg = { qty: number; value: number };
  function aggregate(rows: Array<{ reference_id: string; item_reference: string; quantity_change: number; unit_cost: number }>) {
    const map = new Map<string, ReceiptAgg>();
    for (const r of rows) {
      const key = `${r.reference_id}|${r.item_reference}`;
      const e = map.get(key) || { qty: 0, value: 0 };
      e.qty += r.quantity_change;
      e.value += r.quantity_change * r.unit_cost;
      map.set(key, e);
    }
    return map;
  }
  const storedReceipts = (ledger as any[])
    .filter(r => r.transaction_type === "PO_RECEIPT")
    .map(r => ({ reference_id: r.reference_id, item_reference: r.item_reference, quantity_change: Number(r.quantity_change) || 0, unit_cost: Number(r.unit_cost) || 0 }));
  const rederivedReceipts = trustedPrimitives.filter(r => r.transaction_type === "PO_RECEIPT");
  const storedAgg = aggregate(storedReceipts);
  const rederivedAgg = aggregate(rederivedReceipts);

  type PoFinding = { po: string; item: string; item_name: string; stored_qty: number; stored_unit_cost: number; rederived_qty: number; rederived_unit_cost: number; value_delta: number };
  const poFindings: PoFinding[] = [];
  const allPoKeys = new Set([...storedAgg.keys(), ...rederivedAgg.keys()]);
  for (const key of allPoKeys) {
    const [po, item] = key.split("|");
    const stored = storedAgg.get(key) || { qty: 0, value: 0 };
    const rederived = rederivedAgg.get(key) || { qty: 0, value: 0 };
    const storedUnitCost = stored.qty > 0 ? stored.value / stored.qty : 0;
    const rederivedUnitCost = rederived.qty > 0 ? rederived.value / rederived.qty : 0;
    const qtyDiffers = Math.abs(stored.qty - rederived.qty) > 0.01;
    const costDiffers = Math.abs(storedUnitCost - rederivedUnitCost) > 0.5;
    if (qtyDiffers || costDiffers) {
      poFindings.push({
        po, item, item_name: nameOf(item),
        stored_qty: stored.qty, stored_unit_cost: storedUnitCost,
        rederived_qty: rederived.qty, rederived_unit_cost: rederivedUnitCost,
        value_delta: rederived.value - stored.value,
      });
    }
  }
  console.log(`\n=== SECTION 3: PO_RECEIPT (re-derived landed cost vs currently stored, aggregated per PO+item) ===`);
  console.log(`Purchase order + item combinations with a difference: ${poFindings.length} of ${allPoKeys.size}`);
  for (const f of poFindings) {
    console.log(`  ${f.po} / ${f.item_name}: stored qty=${round(f.stored_qty)} cost=${round(f.stored_unit_cost)} | re-derived qty=${round(f.rederived_qty)} cost=${round(f.rederived_unit_cost)} | value delta=${round(f.value_delta)} VND`);
  }

  // ---- Section 4: production ledger consistency ----
  type ProdFinding = { production_order_id: string; kind: "CONSUME" | "YIELD"; item: string; item_name: string; recorded_operator: number; recorded_ledger: number; delta: number };
  const prodFindings: ProdFinding[] = [];
  const consumeByPoItem = new Map<string, number>();
  for (const item of productionItems as any[]) {
    const key = `${item.production_order_id}|${item.ingredient_id}`;
    consumeByPoItem.set(key, (consumeByPoItem.get(key) || 0) + Number(item.quantity || 0));
  }
  const ledgerConsumeByPoItem = new Map<string, number>();
  const ledgerYieldByPo = new Map<string, number>();
  for (const row of ledger as any[]) {
    if (row.transaction_type === "PRODUCTION_CONSUME") {
      const key = `${row.reference_id}|${row.item_reference}`;
      ledgerConsumeByPoItem.set(key, (ledgerConsumeByPoItem.get(key) || 0) + Math.abs(Number(row.quantity_change) || 0));
    } else if (row.transaction_type === "PRODUCTION_YIELD") {
      ledgerYieldByPo.set(row.reference_id, (ledgerYieldByPo.get(row.reference_id) || 0) + (Number(row.quantity_change) || 0));
    }
  }
  for (const [key, operatorQty] of consumeByPoItem) {
    const [poId, item] = key.split("|");
    const ledgerQty = ledgerConsumeByPoItem.get(key) || 0;
    if (Math.abs(operatorQty - ledgerQty) > 0.01) {
      prodFindings.push({ production_order_id: poId, kind: "CONSUME", item, item_name: nameOf(item), recorded_operator: operatorQty, recorded_ledger: ledgerQty, delta: ledgerQty - operatorQty });
    }
  }
  for (const po of productionOrders as any[]) {
    if (po.status !== "COMPLETED") continue;
    const ledgerYield = ledgerYieldByPo.get(po.id) || 0;
    const operatorYield = Number(po.batch_yield) || 0;
    if (Math.abs(operatorYield - ledgerYield) > 0.01) {
      prodFindings.push({ production_order_id: po.id, kind: "YIELD", item: po.semi_product_id, item_name: nameOf(po.semi_product_id), recorded_operator: operatorYield, recorded_ledger: ledgerYield, delta: ledgerYield - operatorYield });
    }
  }
  console.log(`\n=== SECTION 4: PRODUCTION LEDGER CONSISTENCY (operator-entered vs Stock_Ledger) ===`);
  console.log(`Findings: ${prodFindings.length}`);
  for (const f of prodFindings.slice(0, 15)) {
    console.log(`  ${f.production_order_id} ${f.kind} ${f.item_name}: operator=${round(f.recorded_operator)} ledger=${round(f.recorded_ledger)} delta=${round(f.delta)}`);
  }

  // ---- Persist ----
  const dateStamp = new Date().toISOString().slice(0, 10);
  const outPath = path.resolve(process.cwd(), `docs/audits/${dateStamp}-full-history-recompute-report.json`);
  const artifact = {
    generated_at: new Date().toISOString(),
    summary: {
      lines_replayed: lineResults.length,
      replay_errors: errors.length,
      cost_mismatches: costFindings.length,
      cost_category_a_unlocked: catA.length,
      cost_category_b_locked_current: catB.length,
      cost_category_c_locked_stale: catC.length,
      quantity_items_with_diff: qtyFindings.length,
      quantity_items_negative_theoretical: negativeTheoretical.length,
      po_receipt_findings: poFindings.length,
      production_ledger_findings: prodFindings.length,
    },
    cost_findings: costFindings,
    quantity_findings: qtyFindings,
    po_receipt_findings: poFindings,
    production_findings: prodFindings,
    replay_errors: errors,
    skipped_po_receipts: skippedPoReceipts,
  };
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`\nFull report written to ${outPath}`);
  console.log("\nNo data was written.");
}

function sum(values: number[]): number {
  return Math.round(values.reduce((s, v) => s + v, 0));
}
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
function groupCount(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] || 0) + 1;
  return out;
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
