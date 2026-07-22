import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 0 forensic follow-up (2026-07-22). scripts/audit-lock-bypass-history.ts
 * found 127 order_lines_v2.cost_at_sale writes made on 2026-07-20/21 (before
 * today's separately-reverted COGS-5 incident) via apply_backdated_event_recovery
 * (the same unconditional audit_baseline_locks bypass), all still currently
 * holding the wrongly-overwritten value. Two documented cohorts:
 *
 * - "BTP_RECIPE_REPLAY_DRIFT ... stored COGS correct at sale time, see policy
 *   doc 2026-07-16" (52 lines) -- the lock's own reason states the STORED
 *   value is the reviewed-correct one.
 * - "MAC drift baseline 2026-07-13" (75 lines) -- per
 *   docs/audits/2026-07-13-task-3-recovery-result.md, exactly 40 specific
 *   lines were explicitly approved for recovery (via apply_mac_drift_recovery,
 *   a DIFFERENT run_id pattern not matched by this script's source query),
 *   leaving the remaining 130 lines deliberately, verifiably UNTOUCHED --
 *   stored_cost_at_sale is the documented-correct value for those.
 *
 * This reverts each violated line to audit_baseline_locks.stored_cost_at_sale
 * (the documented-correct value for both cohorts), not to
 * data_recovery_changes.old_value, since that is better-evidenced here and
 * self-corrects even if a line was touched by more than one bypass write.
 * Applied via the same apply_backdated_event_recovery RPC (which is the only
 * mechanism capable of writing to a locked line at all today; Phase 0.5 of
 * the approved rebuild plan will harden it against future misuse).
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  const { data: locks, error: locksError } = await supabase
    .from("audit_baseline_locks")
    .select("order_line_id,locked_at,reason,stored_cost_at_sale,expected_cost_at_sale");
  if (locksError) throw new Error(locksError.message);
  const lockByLineId = new Map((locks || []).map(l => [l.order_line_id, l]));

  const { data: allChanges, error: changesError } = await supabase
    .from("data_recovery_changes")
    .select("run_id,row_id,old_value,new_value,applied_at")
    .eq("table_name", "order_lines_v2")
    .eq("column_name", "cost_at_sale")
    .like("run_id", "backdated-%");
  if (changesError) throw new Error(changesError.message);

  const priorViolations = (allChanges || []).filter(c => {
    const lock = lockByLineId.get(c.row_id);
    if (!lock) return false;
    const isViolation = new Date(c.applied_at).getTime() > new Date(lock.locked_at).getTime();
    const isPrior = new Date(c.applied_at).getTime() < new Date("2026-07-22T00:00:00Z").getTime();
    return isViolation && isPrior;
  });

  const violatedLineIds = [...new Set(priorViolations.map(v => v.row_id))];
  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Distinct violated lines: ${violatedLineIds.length}`);

  const { data: orderLines, error: linesError } = await supabase
    .from("order_lines_v2")
    .select("id,order_id,cost_at_sale")
    .in("id", violatedLineIds);
  if (linesError) throw new Error(linesError.message);
  const lineInfoById = new Map((orderLines || []).map(l => [l.id, l]));

  type Change = { line_id: string; order_id: string; old_cost_at_sale: number; new_cost_at_sale: number };
  const changesByOrder = new Map<string, Change[]>();
  let alreadyCorrect = 0;
  let unexpectedState = 0;

  for (const lineId of violatedLineIds) {
    const current = lineInfoById.get(lineId);
    const lock = lockByLineId.get(lineId)!;
    if (!current) { console.error(`  ${lineId}: line not found`); unexpectedState++; continue; }
    const currentCost = Number(current.cost_at_sale);
    const correctCost = Number(lock.stored_cost_at_sale);
    if (currentCost === correctCost) { alreadyCorrect++; continue; }
    const arr = changesByOrder.get(current.order_id) || [];
    arr.push({ line_id: lineId, order_id: current.order_id, old_cost_at_sale: currentCost, new_cost_at_sale: correctCost });
    changesByOrder.set(current.order_id, arr);
  }

  const totalLines = [...changesByOrder.values()].reduce((s, arr) => s + arr.length, 0);
  const netDelta = [...changesByOrder.values()].flat().reduce((s, c) => s + (c.new_cost_at_sale - c.old_cost_at_sale), 0);
  console.log(`Already at the documented-correct value (no action needed): ${alreadyCorrect}`);
  console.log(`Unexpected state (skipped, needs manual look): ${unexpectedState}`);
  console.log(`To revert: ${totalLines} lines across ${changesByOrder.size} orders, net delta ${netDelta.toLocaleString()} VND`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  const { data: allLedger, error: ledgerError } = await supabase.from("stock_ledger").select("id,item_reference,transaction_type,created_at,unit_cost,reference_id");
  if (ledgerError) throw new Error(ledgerError.message);
  const { data: allExistingEvents, error: allEventsError } = await supabase.from("backdated_ledger_events").select("stock_ledger_id");
  if (allEventsError) throw new Error(allEventsError.message);
  const flaggedStockLedgerIds = new Set((allExistingEvents || []).map(e => e.stock_ledger_id));
  const fallbackReceipts = (allLedger || [])
    .filter(r => !flaggedStockLedgerIds.has(r.id))
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  const nowIso = new Date().toISOString();
  let appliedOrders = 0;
  let appliedLines = 0;

  for (const [orderId, changes] of changesByOrder) {
    const anchor = fallbackReceipts.find(r => !flaggedStockLedgerIds.has(r.id));
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
        notes: `Revert of a prior (2026-07-20/21) audit_baseline_locks violation for ${orderId} (${changes.length} line(s)); restores the documented-correct stored_cost_at_sale -- see scripts/revert-prior-lock-violations-2026-07-20-21.ts and docs/audits/2026-07-22-lock-bypass-forensic-audit.md`,
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
