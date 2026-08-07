import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Plan C Task 4 (docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md).
 * Resets order_lines_v2.cost_at_sale back to its column default (0) for
 * every COMPLETED order's line that still carries a nonzero value. The
 * column stays -- numeric(18,6) not null default 0 -- only the value
 * returns to default. Nothing is dropped.
 *
 * Scope is COMPLETED orders only, matching exactly what Task 1's
 * backup-verification baseline measured (2.507 lines / 24.877.232d on
 * 2026-08-05, immediately before the pre-Task-4 backup) and what the report
 * ever showed a wrong figure for. VOIDED/SUPERSEDED order lines'
 * cost_at_sale was never read by any report before or after Task 2/3 --
 * out of scope of "the report showed the old figure," left untouched.
 *
 * Owner reaffirmed deletion 2026-08-05 after being told the original reason
 * (stop the report showing the old figure) no longer applies -- Tasks 2/3
 * already removed every reader of cost_at_sale. This task's only remaining
 * effect is destroying the record, and the owner chose that anyway.
 *
 * Dry-run by default; --apply writes for real.
 */

const KNOWN_BASELINE_LINES = 2507;
const KNOWN_BASELINE_TOTAL = 24877232;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { formatNumber } = await import("../lib/format");
  const { getPnLDataV2 } = await import("../app/admin/reports/actions");

  console.log("Loading data...");
  const [orders, lines] = (await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
  ])) as any[][];

  const completedOrderIds = new Set(
    orders.filter(o => o.status === "COMPLETED").map(o => o.id),
  );
  const targets = lines.filter(
    l => completedOrderIds.has(l.order_id) && Number(l.cost_at_sale) > 0,
  );

  const lineCount = targets.length;
  const currentTotal = targets.reduce((sum, l) => sum + Number(l.cost_at_sale), 0);

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log("Scope: COMPLETED orders only, order_lines_v2.cost_at_sale > 0.");
  console.log(`Rows to reset: ${lineCount}`);
  console.log(`Current total cost_at_sale: ${formatNumber(currentTotal)}d (exact: ${currentTotal})`);
  console.log("Total after reset: 0d");

  const deltaLines = lineCount - KNOWN_BASELINE_LINES;
  const deltaTotal = currentTotal - KNOWN_BASELINE_TOTAL;
  console.log(
    `\nKnown baseline (Task 1, measured 2026-08-05 immediately before the backup): ` +
      `${KNOWN_BASELINE_LINES} dong / ${formatNumber(KNOWN_BASELINE_TOTAL)}d.`,
  );
  console.log(
    `Difference from baseline: ${deltaLines >= 0 ? "+" : ""}${deltaLines} dong, ` +
      `${deltaTotal >= 0 ? "+" : ""}${formatNumber(deltaTotal)}d.`,
  );

  console.log("\nCurrent PnL (unaffected by this task -- issue-based costing, not cost_at_sale):");
  const juneBefore = await getPnLDataV2({ startDate: "2026-06-01", endDate: "2026-06-30" });
  const julyBefore = await getPnLDataV2({ startDate: "2026-07-01", endDate: "2026-07-31" });
  console.log(`  June revenue: ${formatNumber(juneBefore.totalRevenue)}d`);
  console.log(`  July revenue: ${formatNumber(julyBefore.totalRevenue)}d`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  console.log(`\nFirst ${Math.min(10, targets.length)} targets:`);
  for (const l of targets.slice(0, 10)) {
    console.log(`  order ${l.order_id} line ${l.id}: cost_at_sale ${l.cost_at_sale} -> 0`);
  }

  const supabase = getSupabaseClient();
  const ids: string[] = targets.map(l => l.id);
  const BATCH_SIZE = 100;
  let updated = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("order_lines_v2")
      .update({ cost_at_sale: 0 })
      .in("id", batch)
      .select("id");
    if (error) throw new Error(`Batch update failed at offset ${i}: ${error.message}`);
    updated += data?.length ?? 0;
  }
  console.log(`\nUpdated ${updated} rows (expected ${ids.length}).`);
  if (updated !== ids.length) {
    console.log("MISMATCH -- fewer rows updated than targeted. Investigate before trusting the reset.");
  }

  console.log("\nRe-reading end state...");
  const { count: stillNonzeroInTargetSet, error: verifyTargetsError } = await supabase
    .from("order_lines_v2")
    .select("id", { count: "exact", head: true })
    .in("id", ids)
    .gt("cost_at_sale", 0);
  if (verifyTargetsError) throw new Error(`Verify (targeted set) failed: ${verifyTargetsError.message}`);
  console.log(`  Targeted rows still nonzero: ${stillNonzeroInTargetSet ?? "?"} (expected 0)`);

  const freshOrders = (await findAllNoCache("Orders_V2")) as any[];
  const freshCompletedIds = new Set(freshOrders.filter(o => o.status === "COMPLETED").map(o => o.id));
  const freshLines = (await findAllNoCache("Order_Lines_V2")) as any[];
  const remainingCompletedNonzero = freshLines.filter(
    l => freshCompletedIds.has(l.order_id) && Number(l.cost_at_sale) > 0,
  );
  console.log(
    `  Full re-query (COMPLETED orders, cost_at_sale > 0): ${remainingCompletedNonzero.length} rows ` +
      "(expected 0; a nonzero count here that was not in the targeted set means a sale landed mid-run).",
  );

  console.log("\nStep 5: re-reading June/July PnL to confirm revenue unchanged.");
  const juneAfter = await getPnLDataV2({ startDate: "2026-06-01", endDate: "2026-06-30" });
  const julyAfter = await getPnLDataV2({ startDate: "2026-07-01", endDate: "2026-07-31" });
  console.log(`  June revenue: ${formatNumber(juneAfter.totalRevenue)}d (before: ${formatNumber(juneBefore.totalRevenue)}d)`);
  console.log(`  July revenue: ${formatNumber(julyAfter.totalRevenue)}d (before: ${formatNumber(julyBefore.totalRevenue)}d)`);
  if (juneAfter.totalRevenue !== juneBefore.totalRevenue || julyAfter.totalRevenue !== julyBefore.totalRevenue) {
    console.log("MISMATCH -- revenue moved during this run. Investigate before treating Task 4 as done.");
  } else {
    console.log("  Revenue unchanged, to the dong, both months.");
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
