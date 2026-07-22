import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 0 forensic audit (2026-07-22), read-only. Checks whether today's
 * COGS-5 lock-bypass incident (apply_backdated_event_recovery silently
 * overwriting audit_baseline_locks-protected lines) has happened before,
 * undetected. Joins data_recovery_changes (every write ever made via
 * apply_backdated_event_recovery / apply_backdated_recipe_event_recovery,
 * i.e. run_id like 'backdated-%') against audit_baseline_locks on
 * row_id = order_line_id, filtering to applied_at > locked_at. Also spot
 * checks that today's revert left the 96 lines matching their lock, and
 * that the standard baselines (P&L/MAC consistency, order-ledger quantity
 * mismatch count) are at their known-good state.
 */

async function main() {
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const supabase = getSupabaseClient();

  const { data: locks, error: locksError } = await supabase
    .from("audit_baseline_locks")
    .select("order_line_id,locked_at,reason,stored_cost_at_sale,expected_cost_at_sale");
  if (locksError) throw new Error(locksError.message);
  console.log(`Total audit_baseline_locks rows: ${(locks || []).length}`);

  const lockByLineId = new Map((locks || []).map(l => [l.order_line_id, l]));

  const { data: allChanges, error: changesError } = await supabase
    .from("data_recovery_changes")
    .select("run_id,row_id,old_value,new_value,applied_at")
    .eq("table_name", "order_lines_v2")
    .eq("column_name", "cost_at_sale")
    .like("run_id", "backdated-%");
  if (changesError) throw new Error(changesError.message);
  console.log(`Total data_recovery_changes rows for run_id like 'backdated-%': ${(allChanges || []).length}`);

  const violations = (allChanges || []).filter(c => {
    const lock = lockByLineId.get(c.row_id);
    if (!lock) return false;
    return new Date(c.applied_at).getTime() > new Date(lock.locked_at).getTime();
  });

  console.log(`\n*** Prior lock violations found (before today's COGS-5, excluded below): ${violations.length} ***`);
  const priorViolations = violations.filter(v => new Date(v.applied_at).getTime() < new Date("2026-07-22T00:00:00Z").getTime());
  console.log(`Of which, applied BEFORE 2026-07-22 (i.e. genuinely prior/undetected, not today's already-known incident): ${priorViolations.length}`);
  for (const v of priorViolations) {
    const lock = lockByLineId.get(v.row_id)!;
    console.log(`  line=${v.row_id} run_id=${v.run_id} applied_at=${v.applied_at} wrote old=${v.old_value}->new=${v.new_value} | lock locked_at=${lock.locked_at} reason="${lock.reason}" stored=${lock.stored_cost_at_sale} expected=${lock.expected_cost_at_sale}`);
  }

  console.log(`\nOf which, applied on 2026-07-22 (today's already-known COGS-5 incident, already reverted): ${violations.length - priorViolations.length}`);

  // Spot check: the 96 reverted lines now match their lock's frozen values? (Not
  // necessarily -- some locks were legitimately superseded by Task 3.9's 2026-07-21
  // recovery, so "matches the lock's stored_cost_at_sale" is not always the right
  // check; this just reports current state for visibility, not a pass/fail.)
  const { data: orderLines, error: linesError } = await supabase
    .from("order_lines_v2")
    .select("id,cost_at_sale")
    .in("id", [...lockByLineId.keys()].slice(0, 5000));
  if (linesError) throw new Error(linesError.message);
  const currentById = new Map((orderLines || []).map(l => [l.id, Number(l.cost_at_sale)]));
  let matchesStored = 0;
  let matchesExpected = 0;
  let matchesNeither = 0;
  for (const [lineId, lock] of lockByLineId) {
    const current = currentById.get(lineId);
    if (current === undefined) continue;
    if (current === Number(lock.stored_cost_at_sale)) matchesStored++;
    else if (current === Number(lock.expected_cost_at_sale)) matchesExpected++;
    else matchesNeither++;
  }
  console.log(`\nCurrent state of all ${lockByLineId.size} locked lines: ${matchesStored} match lock.stored_cost_at_sale, ${matchesExpected} match lock.expected_cost_at_sale (i.e. were legitimately recovered, e.g. Task 3.9), ${matchesNeither} match neither (worth a closer look).`);

  // Standard baselines
  const [orders, lines, ledger, recipes, semiProducts] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
  const report = auditOrderLedger({
    orders, lines, ledger, recipes, semiProducts,
    shortfallCutoverAt: "2026-06-25T07:31:08.402Z",
  });
  console.log(`\nBaseline check -- order-ledger quantity mismatches: ${report.mismatches.length} (expected: 203)`);

  const { getPnLDataV2 } = await import("../app/admin/reports/actions");
  const pnl = await getPnLDataV2({});
  const productRowsCogs = pnl.productProfitAnalysis.reduce((s, r) => s + r.cogs, 0);
  const delta = productRowsCogs - pnl.totalCOGS;
  console.log(`Baseline check -- P&L/MAC internal consistency delta: ${delta} VND (expected: 0)`);

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
