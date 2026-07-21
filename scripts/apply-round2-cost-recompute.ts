import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Recomputes cost_at_sale for the 23 orders corrected by Round 2
 * (scripts/apply-btp-shortfall-historical-correction-round2.ts). Their
 * stock-ledger quantities changed (raw ingredients now properly flow
 * through PRODUCTION_CONSUME/PRODUCTION_YIELD instead of a direct debit),
 * which can shift the MAC cost basis -- computeSaleTimeCogs recomputes each
 * line directly from the CURRENT full ledger, so this reflects the
 * corrected quantities automatically, using the true PO-receipt dates for
 * each raw ingredient. Uses the same targeted per-line approach as the
 * earlier shared-ingredient correction tonight (bypasses findAffectedLines
 * entirely, so no other order's cost is touched).
 */

const CORRECTED_ORDER_NOS = [
  "UCK000535", "UCK000536", "PHD001081", "UCK000537", "UCK000539", "UCK000542",
  "PHD001085", "PHD001093", "PHD001091", "PHD001094", "PHD001092", "PHD001083",
  "UCK000534", "PHD001088", "PHD001090", "PHD001086", "PHD001082", "PHD001096",
  "UCK000540", "PHD001084", "PHD001095", "PHD001089", "PHD001087",
];

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { computeSaleTimeCogs } = await import("../lib/backdated-ledger/compute-sale-time-cogs");

  const [orders, lines, ledger, recipes, semiProducts, existingEvents] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("backdated_ledger_events"),
  ]) as any[][];

  const orderByNo = new Map((orders as any[]).map(o => [o.order_no, o]));
  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const arr = linesByOrder.get(line.order_id) || [];
    arr.push(line);
    linesByOrder.set(line.order_id, arr);
  }

  const changesByOrder = new Map<string, Array<{ line_id: string; order_id: string; old_cost_at_sale: number; new_cost_at_sale: number }>>();
  const consumedItemsByOrder = new Map<string, Set<string>>();

  for (const orderNo of CORRECTED_ORDER_NOS) {
    const order = orderByNo.get(orderNo);
    if (!order) {
      console.log(`${orderNo}: order not found -- skipping`);
      continue;
    }
    const orderLines = linesByOrder.get(order.id) || [];
    for (const line of orderLines) {
      const change = computeSaleTimeCogs({
        order,
        line,
        ledger: ledger as any[],
        recipes: recipes as any[],
        semiProducts: semiProducts as any[],
      });
      if (change.old_cost_at_sale === change.new_cost_at_sale) continue;

      const arr = changesByOrder.get(order.id) || [];
      arr.push(change);
      changesByOrder.set(order.id, arr);
    }
  }

  const totalLines = [...changesByOrder.values()].reduce((s, arr) => s + arr.length, 0);
  const netDelta = [...changesByOrder.values()].flat().reduce((s, c) => s + (c.new_cost_at_sale - c.old_cost_at_sale), 0);
  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Affected orders: ${changesByOrder.size}, affected lines: ${totalLines}, net delta: ${netDelta.toLocaleString()} VND`);
  for (const [orderId, changes] of changesByOrder) {
    const order = (orders as any[]).find(o => o.id === orderId);
    for (const c of changes) {
      console.log(`  ${order?.order_no} line=${c.line_id} old=${c.old_cost_at_sale} new=${c.new_cost_at_sale} delta=${c.new_cost_at_sale - c.old_cost_at_sale}`);
    }
  }

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }
  if (changesByOrder.size === 0) {
    console.log("\nNothing to apply.");
    return;
  }

  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const flaggedStockLedgerIds = new Set((existingEvents as any[]).map(e => e.stock_ledger_id));
  const fallbackAnchors = (ledger as any[])
    .filter(r => !flaggedStockLedgerIds.has(r.id))
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  for (const [orderId, changes] of changesByOrder) {
    const consumedItems = consumedItemsByOrder.get(orderId) || new Set<string>();
    let anchor = (ledger as any[])
      .filter(r => r.transaction_type === "PO_RECEIPT" && consumedItems.has(r.item_reference) && !flaggedStockLedgerIds.has(r.id))
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())[0];
    if (!anchor) anchor = fallbackAnchors.find(r => !flaggedStockLedgerIds.has(r.id));
    if (!anchor) throw new Error(`${orderId}: no available anchor row found`);

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
        notes: `Round 2 quantity-correction cost recompute for order ${orderId}; targeted per-line, not derived from findAffectedLines -- see scripts/apply-round2-cost-recompute.ts`,
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
  }

  console.log(`\nApplied cost corrections to ${changesByOrder.size} orders / ${totalLines} lines.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
