import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-time targeted correction (2026-07-21) for the 5 known cost_at_sale
 * mismatches whose consumed items (NNL-002, NNL-003, ING-003, ING-006,
 * NNL-001, ING-001, ING-004, ING-020, ING-015, ING-022, ING-016, NNL-005)
 * are too broadly shared to safely backfill with the normal item+time-window
 * backdated_ledger_events mechanism (a dry run showed that mechanism would
 * retroactively recompute hundreds of unrelated historical "migrated" order
 * lines dating back to 2026-03, with deltas far larger than these 5 known
 * lines -- an unrelated, much bigger question deferred to a separate
 * investigation per owner decision).
 *
 * Instead of findAffectedLines (which scans by item_reference across a time
 * window), this computes the correct cost DIRECTLY for exactly these 5
 * known (order_id, line_id) pairs via computeSaleTimeCogs, so no other line
 * is touched no matter how widely its ingredients are shared. Still goes
 * through the same audited RPC path (apply_backdated_event_recovery +
 * mark_backdated_event_recomputed) as every other backdated-ledger
 * correction tonight, for a consistent data_recovery_changes audit trail --
 * one lightweight event row per line, anchored on a real (but otherwise
 * out-of-scope) unflagged PO_RECEIPT for one of that line's consumed items,
 * purely for record-keeping (the RPC applies exactly the single change
 * passed in, it does not re-derive scope from the event).
 *
 * Dry-run recomputes and prints the 5 changes without writing anything;
 * --apply inserts one event per line and applies it for real.
 */

const TARGETS: Array<{ orderNo: string; lineId: string; anchorItem: string }> = [
  { orderNo: "PHD000796", lineId: "ol-0c935fa5-57c4-4b3e-91d9-61e64db22a4e", anchorItem: "NNL-002" },
  { orderNo: "PHD000816", lineId: "ol-f301f8a8-bdc2-405b-8354-d63d4c265821", anchorItem: "ING-003" },
  { orderNo: "PHD000792", lineId: "ol-537d7a6c-e275-4b10-b46d-be50a57b7d08", anchorItem: "NNL-001" },
  { orderNo: "PHD000801", lineId: "ol-afaf7d7e-1fb6-49c2-8553-71fe7c471d86", anchorItem: "ING-004" },
  { orderNo: "UCK000514", lineId: "ol-6d9ccfcf-0531-4ea3-8305-3246e20ff573", anchorItem: "ING-020" },
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

  const orderById = new Map((orders as any[]).map(o => [o.id, o]));
  const lineById = new Map((lines as any[]).map(l => [l.id, l]));
  const flaggedStockLedgerIds = new Set((existingEvents as any[]).map(e => e.stock_ledger_id));
  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);

  for (const target of TARGETS) {
    const line = lineById.get(target.lineId);
    if (!line) {
      console.log(`\n${target.orderNo} line=${target.lineId}: line not found -- skipping`);
      continue;
    }
    const order = orderById.get(line.order_id);
    if (!order) {
      console.log(`\n${target.orderNo} line=${target.lineId}: order not found -- skipping`);
      continue;
    }

    const change = computeSaleTimeCogs({
      order,
      line,
      ledger: ledger as any[],
      recipes: recipes as any[],
      semiProducts: semiProducts as any[],
    });

    console.log(`\n${target.orderNo} line=${target.lineId}: old=${change.old_cost_at_sale} new=${change.new_cost_at_sale} delta=${change.new_cost_at_sale - change.old_cost_at_sale}`);

    if (change.old_cost_at_sale === change.new_cost_at_sale) {
      console.log(`  No change needed -- skipping`);
      continue;
    }

    if (!apply) {
      console.log(`  Would insert 1 event + apply this single change (dry run only)`);
      continue;
    }

    const anchorReceipt = (ledger as any[])
      .filter(r => r.transaction_type === "PO_RECEIPT" && r.item_reference === target.anchorItem)
      .filter(r => !flaggedStockLedgerIds.has(r.id))
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())[0];

    if (!anchorReceipt) {
      throw new Error(`${target.orderNo}: no unflagged PO_RECEIPT found for anchor item ${target.anchorItem}`);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("backdated_ledger_events")
      .insert({
        stock_ledger_id: anchorReceipt.id,
        effective_timestamp: anchorReceipt.created_at,
        visibility_timestamp: nowIso,
        source_table: "stock_ledger",
        source_id: anchorReceipt.reference_id,
        item_reference: target.anchorItem,
        quantity_change: anchorReceipt.quantity_change,
        unit_cost: Math.round(Number(anchorReceipt.unit_cost)),
        notes: `Targeted single-line correction for ${target.orderNo}/${target.lineId}; scope intentionally NOT derived from findAffectedLines (anchor item is too broadly shared) -- see scripts/apply-targeted-cost-correction-shared-ingredient-lines.ts`,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    const eventId = inserted.id;
    flaggedStockLedgerIds.add(anchorReceipt.id);
    console.log(`  Inserted event ${eventId} (anchor stock_ledger_id=${anchorReceipt.id})`);

    const { data: applyResult, error: applyError } = await supabase.rpc("apply_backdated_event_recovery", {
      p_event_id: eventId,
      p_reviewer: "Claude",
      p_changes: [change],
    });
    if (applyError) throw new Error(applyError.message);

    const { data: markResult, error: markError } = await supabase.rpc("mark_backdated_event_recomputed", {
      p_event_id: eventId,
      p_reviewer: "Claude",
      p_run_id: `backdated-${eventId}`,
      p_change_count: 1,
    });
    if (markError) throw new Error(markError.message);

    console.log(`  Applied: ${JSON.stringify(applyResult)} / ${JSON.stringify(markResult)}`);
  }

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
