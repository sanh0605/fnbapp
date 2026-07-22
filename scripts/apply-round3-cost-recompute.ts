import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Recomputes cost_at_sale for the orders corrected by Round 3
 * (scripts/apply-btp-shortfall-historical-correction-round3.ts) plus the 2
 * direct-consumption-loss fixes, same rationale and pattern as
 * scripts/apply-round2-cost-recompute.ts. Finds the affected orders
 * directly from today's RECLASSIFY_2026-07-20-tagged rows (created_at
 * 2026-07-21) rather than a hardcoded list, since Round 3 touched more
 * orders than Round 2.
 */

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

  // Orders touched today by Round 3 or its direct-consumption-loss fix.
  // (Round 2's cost recompute inserted 0 events -- it found 0 lines needing
  // a change across all 23 orders -- so there is nothing to exclude here.)
  const todaysCorrectedOrderIds = new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("RECLASSIFY_2026-07-20") && String(r.created_at || "").startsWith("2026-07-21"))
      .map(r => r.reference_id),
  );

  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    const arr = linesByOrder.get(line.order_id) || [];
    arr.push(line);
    linesByOrder.set(line.order_id, arr);
  }

  const changesByOrder = new Map<string, Array<{ line_id: string; order_id: string; old_cost_at_sale: number; new_cost_at_sale: number }>>();

  for (const orderId of todaysCorrectedOrderIds) {
    const order = (orders as any[]).find(o => o.id === orderId);
    if (!order) continue;
    const orderLines = linesByOrder.get(orderId) || [];
    for (const line of orderLines) {
      const change = computeSaleTimeCogs({
        order,
        line,
        ledger: ledger as any[],
        recipes: recipes as any[],
        semiProducts: semiProducts as any[],
      });
      if (change.old_cost_at_sale === change.new_cost_at_sale) continue;
      const arr = changesByOrder.get(orderId) || [];
      arr.push(change);
      changesByOrder.set(orderId, arr);
    }
  }

  const totalLines = [...changesByOrder.values()].reduce((s, arr) => s + arr.length, 0);
  const netDelta = [...changesByOrder.values()].flat().reduce((s, c) => s + (c.new_cost_at_sale - c.old_cost_at_sale), 0);
  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Orders checked: ${todaysCorrectedOrderIds.size}`);
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
    const anchor = fallbackAnchors.find(r => !flaggedStockLedgerIds.has(r.id));
    if (!anchor) throw new Error(`${orderId}: no available anchor row found`);

    const { data: inserted, error: insertError } = await supabase
      .from("backdated_ledger_events")
      .insert({
        stock_ledger_id: anchor.id,
        effective_timestamp: anchor.created_at,
        visibility_timestamp: nowIso,
        source_table: "stock_ledger",
        source_id: orderId,
        item_reference: anchor.item_reference,
        quantity_change: anchor.quantity_change,
        unit_cost: Math.round(Number(anchor.unit_cost)),
        notes: `Round 3 quantity-correction cost recompute for order ${orderId}; targeted per-line, not derived from findAffectedLines -- see scripts/apply-round3-cost-recompute.ts`,
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
