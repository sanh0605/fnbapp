import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * COGS-5 (2026-07-22): full-system cost_at_sale correction. A read-only
 * audit found audit-pnl-mac-consistency.ts never actually compares stored
 * cost_at_sale against a fresh recompute (it only checks internal
 * consistency between report aggregations of the already-stored value), so
 * the true scope of stale cost_at_sale lines was unknown. This script scans
 * every COMPLETED, non-superseded order (any date, no cutover gate --
 * commit 21f7438's cost-neutral-by-construction invariant means this
 * recompute is reliable even pre-2026-06-25, unlike the quantity-ledger
 * audit) and corrects exactly the lines found mismatched.
 *
 * Same targeted pattern as apply-migrated-orders-mac-correction.ts and
 * apply-targeted-cost-correction-shared-ingredient-lines.ts: computes the
 * correct cost DIRECTLY per known (order_id, line_id), bypassing
 * findAffectedLines entirely, so no line outside the scanned mismatch list
 * is ever touched regardless of how shared an ingredient is. Groups changes
 * per order into one backdated_ledger_events row (audit-trail anchor only;
 * the RPC applies exactly the p_changes array passed in), applied through
 * the same audited RPCs (apply_backdated_event_recovery +
 * mark_backdated_event_recomputed) as every other correction.
 *
 * Dry-run recomputes and prints a summary without writing; --apply inserts
 * one event per affected order and applies it for real.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const {
    buildLineConsumptionRows,
    buildSemiProductRecipeMaps,
    buildInventoryBalances,
  } = await import("../lib/inventory-consumption");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const { computeMacCostForConsumptionRows } = await import("../lib/mac-cogs");

  const [orders, lines, ledger, recipes, semiProducts, existingEvents] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("backdated_ledger_events"),
  ]) as any[][];

  const targetOrders = (orders as any[]).filter(o => o.status === "COMPLETED" && !o.superseded_by);
  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const sortedLedger = [...(ledger as any[])].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );

  type Change = { line_id: string; order_id: string; old_cost_at_sale: number; new_cost_at_sale: number };
  const changesByOrder = new Map<string, Change[]>();
  const consumedItemsByOrder = new Map<string, Set<string>>();

  for (const order of targetOrders) {
    const orderLines = linesByOrder.get(order.id) || [];
    if (orderLines.length === 0) continue;
    const orderTime = new Date(order.created_at).getTime();
    const pastLedger = sortedLedger.filter(r => {
      const rowTime = new Date(r.created_at || 0).getTime();
      return rowTime <= orderTime && r.reference_id !== order.id;
    });
    const balances = buildInventoryBalances(pastLedger, order.created_at);
    const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[], order.created_at);

    for (const line of orderLines) {
      let rows;
      try {
        const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
        rows = buildLineConsumptionRows(lineRecipe, Number(line.qty), new Map(balances), consumptionMaps);
      } catch {
        continue;
      }
      if (rows.length === 0) continue;
      const newCost = computeMacCostForConsumptionRows(rows, pastLedger, order.created_at, consumptionMaps);
      const stored = Number(line.cost_at_sale);
      if (Math.abs(newCost - stored) <= 1) continue;

      const arr = changesByOrder.get(order.id) || [];
      arr.push({ line_id: line.id, order_id: order.id, old_cost_at_sale: stored, new_cost_at_sale: newCost });
      changesByOrder.set(order.id, arr);

      const itemSet = consumedItemsByOrder.get(order.id) || new Set<string>();
      for (const row of rows) itemSet.add(row.item_reference);
      consumedItemsByOrder.set(order.id, itemSet);
    }
  }

  const totalLines = [...changesByOrder.values()].reduce((s, arr) => s + arr.length, 0);
  const netDelta = [...changesByOrder.values()].flat().reduce((s, c) => s + (c.new_cost_at_sale - c.old_cost_at_sale), 0);
  const absDelta = [...changesByOrder.values()].flat().reduce((s, c) => s + Math.abs(c.new_cost_at_sale - c.old_cost_at_sale), 0);
  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Affected orders: ${changesByOrder.size}, affected lines: ${totalLines}`);
  console.log(`Net delta: ${netDelta.toLocaleString()} VND, sum abs delta: ${absDelta.toLocaleString()} VND`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const flaggedStockLedgerIds = new Set((existingEvents as any[]).map(e => e.stock_ledger_id));
  const fallbackReceipts = (ledger as any[])
    .filter(r => !flaggedStockLedgerIds.has(r.id))
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  let appliedOrders = 0;
  let appliedLines = 0;

  for (const [orderId, changes] of changesByOrder) {
    const consumedItems = consumedItemsByOrder.get(orderId) || new Set<string>();
    let anchor = (ledger as any[])
      .filter(r => r.transaction_type === "PO_RECEIPT" && consumedItems.has(r.item_reference) && !flaggedStockLedgerIds.has(r.id))
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())[0];

    if (!anchor) {
      anchor = fallbackReceipts.find(r => !flaggedStockLedgerIds.has(r.id));
    }
    if (!anchor) {
      console.error(`  ${orderId}: no available anchor receipt found -- skipping ${changes.length} line(s)`);
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("backdated_ledger_events")
      .insert({
        stock_ledger_id: anchor.id,
        effective_timestamp: anchor.created_at,
        visibility_timestamp: nowIso,
        source_table: "stock_ledger",
        source_id: anchor.reference_id,
        item_reference: anchor.item_reference,
        quantity_change: anchor.quantity_change,
        unit_cost: Math.round(Number(anchor.unit_cost)),
        notes: `COGS-5 full-system cost correction for ${orderId} (${changes.length} line(s)); targeted per-line, not derived from findAffectedLines -- see scripts/apply-cogs5-full-cost-correction.ts`,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(`${orderId}: ${insertError.message}`);
    const eventId = inserted.id;
    flaggedStockLedgerIds.add(anchor.id);

    const { error: applyError } = await supabase.rpc("apply_backdated_event_recovery", {
      p_event_id: eventId,
      p_reviewer: "Claude",
      p_changes: changes,
    });
    if (applyError) throw new Error(`${orderId}: ${applyError.message}`);

    const { error: markError } = await supabase.rpc("mark_backdated_event_recomputed", {
      p_event_id: eventId,
      p_reviewer: "Claude",
      p_run_id: `backdated-${eventId}`,
      p_change_count: changes.length,
    });
    if (markError) throw new Error(`${orderId}: ${markError.message}`);

    appliedOrders++;
    appliedLines += changes.length;
  }

  console.log(`\nApplied: ${appliedOrders} orders, ${appliedLines} lines`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
