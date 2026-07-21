import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-time backfill (2026-07-21) for the seed-era NNL-007 (raw ingredient)
 * PO_RECEIPT rows that predate migration 0014's detect_backdated_ledger_entry
 * trigger, so no backdated_ledger_events row was ever created for them.
 * Confirmed narrow: NNL-007's earliest unflagged receipt is 2026-06-04
 * (recent, item is not broadly shared), producing exactly 18 cost changes
 * across 18 order lines -- matches the known PHD000795-899-range cohort
 * exactly, no wider blast radius. Other items initially considered for this
 * backfill (NNL-002, ING-003, NNL-001, etc.) were EXCLUDED after a dry run
 * showed their earliest unflagged receipt dates back to 2026-03, which would
 * retroactively recompute hundreds of unrelated historical "migrated" order
 * lines with much larger deltas -- out of scope, handled separately per
 * owner decision (see scripts/apply-targeted-cost-correction-shared-ingredient-lines.ts
 * for the 5 known lines that share those items, corrected directly instead).
 *
 * Dry-run previews the recompute plan directly; --apply inserts the event
 * row and immediately runs recomputeEventApply for real. Idempotent:
 * re-running is safe (unique stock_ledger_id constraint).
 */

const ITEM_REFERENCE = "NNL-007";

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { recomputeEventApply, recomputeEventDryRun } = await import("../lib/backdated-ledger/recompute-event");
  const { findAffectedLines } = await import("../lib/backdated-ledger/find-affected-lines");
  const { computeSaleTimeCogs } = await import("../lib/backdated-ledger/compute-sale-time-cogs");

  const [ledger, existingEvents, orders, lines, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("backdated_ledger_events"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const flaggedStockLedgerIds = new Set((existingEvents as any[]).map(e => e.stock_ledger_id));

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);

  const candidates = (ledger as any[])
    .filter(r => r.transaction_type === "PO_RECEIPT" && r.item_reference === ITEM_REFERENCE)
    .filter(r => !flaggedStockLedgerIds.has(r.id))
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  if (candidates.length === 0) {
    console.log(`${ITEM_REFERENCE}: no unflagged PO_RECEIPT rows found -- nothing to do`);
    return;
  }

  const earliest = candidates[0];
  console.log(`${ITEM_REFERENCE}: anchor stock_ledger_id=${earliest.id} effective=${earliest.created_at} (${candidates.length} unflagged receipts total)`);

  const { data: existing } = await supabase
    .from("backdated_ledger_events")
    .select("id, status")
    .eq("stock_ledger_id", earliest.id)
    .maybeSingle();

  if (!apply) {
    const affectedLines = findAffectedLines({
      event: {
        id: "preview",
        item_reference: ITEM_REFERENCE,
        effective_timestamp: earliest.created_at,
        visibility_timestamp: nowIso,
      },
      orders: orders as any[],
      lines: lines as any[],
      ledger: ledger as any[],
      recipes: recipes as any[],
      semiProducts: semiProducts as any[],
    });
    const orderById = new Map((orders as any[]).map(o => [o.id, o]));
    const lineById = new Map((lines as any[]).map(l => [l.id, l]));
    const changes = affectedLines
      .map(affectedLine => computeSaleTimeCogs({
        order: orderById.get(affectedLine.order_id),
        line: lineById.get(affectedLine.line_id),
        ledger: ledger as any[],
        recipes: recipes as any[],
        semiProducts: semiProducts as any[],
      }))
      .filter(change => change.old_cost_at_sale !== change.new_cost_at_sale);
    console.log(`  ${existing ? `Event already exists: ${existing.id} (status=${existing.status})` : "Would insert a new event"}`);
    console.log(`  Affected lines: ${affectedLines.length}, cost changes: ${changes.length}`);
    for (const change of changes) {
      console.log(`    line=${change.line_id} order=${change.order_id} old=${change.old_cost_at_sale} new=${change.new_cost_at_sale} delta=${change.new_cost_at_sale - change.old_cost_at_sale}`);
    }
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  let eventId: string;
  if (existing) {
    console.log(`  Event already exists: ${existing.id} (status=${existing.status})`);
    eventId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("backdated_ledger_events")
      .insert({
        stock_ledger_id: earliest.id,
        effective_timestamp: earliest.created_at,
        visibility_timestamp: nowIso,
        source_table: "stock_ledger",
        source_id: earliest.reference_id,
        item_reference: ITEM_REFERENCE,
        quantity_change: earliest.quantity_change,
        unit_cost: Math.round(Number(earliest.unit_cost)),
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    eventId = inserted.id;
    console.log(`  Inserted event ${eventId}`);
  }

  const result = await recomputeEventApply(eventId, "Claude");
  console.log(`  Affected lines: ${result.affected_lines.length}, cost changes: ${result.changes.length}`);
  for (const change of result.changes) {
    console.log(`    line=${change.line_id} order=${change.order_id} old=${change.old_cost_at_sale} new=${change.new_cost_at_sale} delta=${change.new_cost_at_sale - change.old_cost_at_sale}`);
  }
  console.log(`  Applied: ${JSON.stringify(result.apply_result)} / ${JSON.stringify(result.mark_result)}`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
