import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * URGENT revert (2026-07-22). scripts/apply-cogs5-full-cost-correction.ts
 * wrote to 96 of its 112 "corrected" lines despite those lines already
 * having an audit_baseline_locks row (a deliberately reviewed, protected
 * cost_at_sale value from earlier work: Task 3.9's 2026-07-21 historical-
 * gap recovery, or the 2026-07-13 MAC drift baseline lock). This should
 * have been blocked by the prevent_audit_locked_order_line_mutation
 * trigger (migration 0012), but apply_backdated_event_recovery (migration
 * 0015) unconditionally sets app.mac_drift_recovery=on before writing,
 * which bypasses that trigger without the strict per-lock value validation
 * apply_mac_drift_recovery performs. COGS-5's blind recompute does not
 * account for the specialized backdated-ledger-visibility methodology
 * those locks and recoveries used, so it silently reverted 96 previously
 * reviewed/correct values back to a naive (and in Task 3.9's case,
 * previously-considered-and-superseded) recompute.
 *
 * This script reverses EXACTLY what apply-cogs5-full-cost-correction.ts
 * wrote for the locked lines only: reads data_recovery_changes for the
 * COGS-5 run_ids, keeps only rows whose line_id has an audit_baseline_locks
 * entry, and writes old_value back over new_value via the same audited RPC
 * pattern. The 16 lines with no lock are left untouched (those were a
 * genuine, safe correction).
 *
 * Dry-run by default; --apply writes for real.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");

  const supabase = getSupabaseClient();

  const { data: locks, error: locksError } = await supabase
    .from("audit_baseline_locks")
    .select("order_line_id");
  if (locksError) throw new Error(locksError.message);
  const lockedLineIds = new Set((locks || []).map(l => l.order_line_id));

  const { data: cogs5Events, error: eventsError } = await supabase
    .from("backdated_ledger_events")
    .select("id,notes")
    .ilike("notes", "%COGS-5 full-system cost correction%");
  if (eventsError) throw new Error(eventsError.message);

  const cogs5RunIds = (cogs5Events || []).map(e => `backdated-${e.id}`);
  const eventIdByRunId = new Map((cogs5Events || []).map(e => [`backdated-${e.id}`, e.id]));

  type Row = { run_id: string; row_id: string; old_value: unknown; new_value: unknown };
  const allChanges: Row[] = [];
  const batchSize = 200;
  for (let i = 0; i < cogs5RunIds.length; i += batchSize) {
    const batch = cogs5RunIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("data_recovery_changes")
      .select("run_id,row_id,old_value,new_value")
      .in("run_id", batch);
    if (error) throw new Error(error.message);
    allChanges.push(...((data || []) as Row[]));
  }

  const toRevert = allChanges.filter(c => lockedLineIds.has(c.row_id));
  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Total COGS-5 changes: ${allChanges.length}. Locked (need revert): ${toRevert.length}. Not locked (leave as-is): ${allChanges.length - toRevert.length}.`);

  // Need order_id per line for the RPC payload.
  const { data: orderLines, error: linesError } = await supabase
    .from("order_lines_v2")
    .select("id,order_id,cost_at_sale")
    .in("id", toRevert.map(r => r.row_id));
  if (linesError) throw new Error(linesError.message);
  const lineInfoById = new Map((orderLines || []).map(l => [l.id, l]));

  const netDelta = toRevert.reduce((s, r) => s + (Number(r.old_value) - Number(r.new_value)), 0);
  console.log(`Net delta of the revert: ${netDelta.toLocaleString()} VND`);

  let mismatchCount = 0;
  for (const r of toRevert) {
    const current = lineInfoById.get(r.row_id);
    if (!current) { console.error(`  ${r.row_id}: line not found`); mismatchCount++; continue; }
    if (Number(current.cost_at_sale) !== Number(r.new_value)) {
      console.error(`  ${r.row_id}: current cost_at_sale=${current.cost_at_sale} does not match expected COGS-5 new_value=${r.new_value} -- line changed since, skipping to be safe`);
      mismatchCount++;
    }
  }
  console.log(`Lines that no longer match the expected pre-revert state (skipped): ${mismatchCount}`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  const { data: allLedger, error: ledgerError } = await supabase.from("stock_ledger").select("id,item_reference,transaction_type,created_at,unit_cost,reference_id");
  if (ledgerError) throw new Error(ledgerError.message);
  const { data: allExistingEvents, error: allEventsError } = await supabase.from("backdated_ledger_events").select("stock_ledger_id");
  if (allEventsError) throw new Error(allEventsError.message);
  const flaggedStockLedgerIds = new Set((allExistingEvents || []).map(e => e.stock_ledger_id));

  const changesByOrder = new Map<string, Array<{ line_id: string; order_id: string; old_cost_at_sale: number; new_cost_at_sale: number }>>();
  for (const r of toRevert) {
    const current = lineInfoById.get(r.row_id);
    if (!current) continue;
    if (Number(current.cost_at_sale) !== Number(r.new_value)) continue;
    const arr = changesByOrder.get(current.order_id) || [];
    arr.push({
      line_id: r.row_id,
      order_id: current.order_id,
      old_cost_at_sale: Number(r.new_value),
      new_cost_at_sale: Number(r.old_value),
    });
    changesByOrder.set(current.order_id, arr);
  }

  const nowIso = new Date().toISOString();
  const fallbackReceipts = (allLedger || [])
    .filter(r => !flaggedStockLedgerIds.has(r.id))
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  let appliedOrders = 0;
  let appliedLines = 0;

  for (const [orderId, changes] of changesByOrder) {
    let anchor = fallbackReceipts.find(r => !flaggedStockLedgerIds.has(r.id));
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
        quantity_change: 0,
        unit_cost: Math.round(Number(anchor.unit_cost || 0)),
        notes: `Revert of COGS-5 lock-violation for ${orderId} (${changes.length} line(s)); restores the audit_baseline_locks-protected value COGS-5 wrongly overwrote -- see scripts/revert-cogs5-lock-violations.ts`,
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

  console.log(`\nReverted: ${appliedOrders} orders, ${appliedLines} lines`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
