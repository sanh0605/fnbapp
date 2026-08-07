import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Plan C Task 4 (docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md).
 * Resets order_lines_v2.cost_at_sale back to its column default (0) for
 * every row that still carries a nonzero value, regardless of the owning
 * order's status. The column stays -- numeric(18,6) not null default 0 --
 * only the value returns to default. Nothing is dropped.
 *
 * Scope decided by the owner 2026-08-07, correcting an earlier COMPLETED-only
 * draft of this script: "no report reads it" does not pick out
 * status = 'COMPLETED'. Splitting COMPLETED further by superseded_by showed
 * 911 COMPLETED-but-superseded lines that no report reads either, and they
 * were still inside the COMPLETED-only scope -- so the reason given did not
 * match the line actually drawn, and would have left 327.047d of old cost
 * scattered with no consistent justification. Owner chose to delete
 * everything rather than draw a boundary the stated reason cannot defend.
 *
 * Owner reaffirmed deletion 2026-08-05 after being told the original reason
 * (stop the report showing the old figure) no longer applies -- Tasks 2/3
 * already removed every reader of cost_at_sale. This task's only remaining
 * effect is destroying the record, and the owner chose that anyway.
 *
 * Dry-run by default; --apply writes for real.
 */

const KNOWN_BASELINE_LINES = 2590;
const KNOWN_BASELINE_TOTAL = 25588859.619575;

// Widened 2026-08-07 on the owner's question: why did the revenue gate only
// cover June/July when April and May also have sales? It did not track the
// data, just earlier work. April/May/June/July are known-good, verified
// against getPnLDataV2 (never a hand-rolled sum), and used as a hard gate
// here. August is open and rises with every sale -- measured and reported,
// never compared against a constant.
type MonthCheck = { label: string; startDate: string; endDate: string; knownRevenue: number | null };
const MONTH_CHECKS: MonthCheck[] = [
  { label: "2026-04", startDate: "2026-04-01", endDate: "2026-04-30", knownRevenue: 2190000 },
  { label: "2026-05", startDate: "2026-05-01", endDate: "2026-05-31", knownRevenue: 7675000 },
  { label: "2026-06", startDate: "2026-06-01", endDate: "2026-06-30", knownRevenue: 22157000 },
  { label: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31", knownRevenue: 18661000 },
  { label: "2026-08", startDate: "2026-08-01", endDate: "2026-08-31", knownRevenue: null },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { formatNumber } = await import("../lib/format");
  const { getPnLDataV2 } = await import("../app/admin/reports/actions");

  console.log("Loading data...");
  const lines = (await findAllNoCache("Order_Lines_V2")) as any[];

  const targets = lines.filter(l => Number(l.cost_at_sale) > 0);

  const lineCount = targets.length;
  const currentTotal = targets.reduce((sum, l) => sum + Number(l.cost_at_sale), 0);

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log("Scope: every order_lines_v2 row with cost_at_sale > 0, regardless of order status.");
  console.log(`Rows to reset: ${lineCount}`);
  console.log(`Current total cost_at_sale: ${formatNumber(currentTotal)}d (exact: ${currentTotal})`);
  console.log("Total after reset: 0d");

  // Printed in both modes -- CLAUDE.md section 2 requires the exact objects,
  // not just the count, before a production write, and a dry run is the
  // owner's only chance to look before approving --apply.
  console.log(`\nFirst ${Math.min(10, targets.length)} targets:`);
  for (const l of targets.slice(0, 10)) {
    console.log(`  order ${l.order_id} line ${l.id}: cost_at_sale ${l.cost_at_sale} -> 0`);
  }

  const deltaLines = lineCount - KNOWN_BASELINE_LINES;
  const deltaTotal = currentTotal - KNOWN_BASELINE_TOTAL;
  console.log(
    `\nKnown baseline (owner-verified 2026-08-07 measurement, whole-table scope): ` +
      `${KNOWN_BASELINE_LINES} dong / ${formatNumber(KNOWN_BASELINE_TOTAL)}d.`,
  );
  console.log(
    `Difference from baseline: ${deltaLines >= 0 ? "+" : ""}${deltaLines} dong, ` +
      `${deltaTotal >= 0 ? "+" : ""}${formatNumber(deltaTotal)}d.`,
  );

  console.log("\nCurrent PnL, every month with sales (unaffected by this task -- issue-based costing, not cost_at_sale):");
  const revenueBefore = new Map<string, number>();
  for (const m of MONTH_CHECKS) {
    const r = await getPnLDataV2({ startDate: m.startDate, endDate: m.endDate });
    revenueBefore.set(m.label, r.totalRevenue);
    if (m.knownRevenue === null) {
      console.log(`  ${m.label} revenue: ${formatNumber(r.totalRevenue)}d (open month, not gated)`);
    } else {
      const matches = r.totalRevenue === m.knownRevenue;
      console.log(
        `  ${m.label} revenue: ${formatNumber(r.totalRevenue)}d ` +
          `(known: ${formatNumber(m.knownRevenue)}d${matches ? ", matches" : ", GATE MISMATCH"})`,
      );
    }
  }

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  const { batchIds } = await import("./reset-cost-at-sale-core");

  const failures: string[] = [];
  const supabase = getSupabaseClient();
  const ids: string[] = targets.map(l => l.id);
  const BATCH_SIZE = 100;
  let updated = 0;
  for (const batch of batchIds(ids, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("order_lines_v2")
      .update({ cost_at_sale: 0 })
      .in("id", batch)
      .select("id");
    if (error) throw new Error(`Batch update failed: ${error.message}`);
    updated += data?.length ?? 0;
  }
  console.log(`\nUpdated ${updated} rows (expected ${ids.length}).`);
  if (updated !== ids.length) {
    failures.push(`Write shortfall: updated ${updated} rows, expected ${ids.length}.`);
  }

  console.log("\nRe-reading end state...");
  // Same .in() URL-length limit applies to reads as to writes -- batch this
  // the same way and at the same size as the write loop above. The original
  // version of this script batched the write but sent all 2.590 targeted
  // ids in a single unbatched .in() here; at production volume the request
  // broke at the transport layer before a structured response existed to
  // read an error message from, and the write itself (already committed)
  // was reported as an unexplained failure.
  let stillNonzeroInTargetSet = 0;
  for (const batch of batchIds(ids, BATCH_SIZE)) {
    const { count, error: verifyTargetsError } = await supabase
      .from("order_lines_v2")
      .select("id", { count: "exact", head: true })
      .in("id", batch)
      .gt("cost_at_sale", 0);
    if (verifyTargetsError) throw new Error(`Verify (targeted set) failed: ${verifyTargetsError.message}`);
    stillNonzeroInTargetSet += count ?? 0;
  }
  console.log(`  Targeted rows still nonzero: ${stillNonzeroInTargetSet} (expected 0)`);
  if (stillNonzeroInTargetSet !== 0) {
    failures.push(`${stillNonzeroInTargetSet} targeted rows are still nonzero after the write.`);
  }

  // Whole-table re-query, not scoped to any order status -- the check must
  // cover exactly what was written, or a narrower check can report success
  // while rows outside its own filter sit untouched.
  const freshLines = (await findAllNoCache("Order_Lines_V2")) as any[];
  const remainingNonzero = freshLines.filter(l => Number(l.cost_at_sale) > 0);
  console.log(
    `  Full re-query (whole order_lines_v2, cost_at_sale > 0): ${remainingNonzero.length} rows ` +
      "(expected 0; a nonzero count here that was not in the targeted set means a sale landed mid-run).",
  );
  if (remainingNonzero.length !== 0) {
    failures.push(`${remainingNonzero.length} rows in the whole table are still nonzero after the write.`);
  }

  console.log("\nStep 5: re-reading PnL for every gated month to confirm revenue unchanged.");
  for (const m of MONTH_CHECKS) {
    const r = await getPnLDataV2({ startDate: m.startDate, endDate: m.endDate });
    const before = revenueBefore.get(m.label)!;
    const movedThisRun = r.totalRevenue !== before;
    console.log(`  ${m.label} revenue: ${formatNumber(r.totalRevenue)}d (before this run: ${formatNumber(before)}d)`);

    if (m.knownRevenue === null) {
      // Open month: a mid-run sale is expected, not a failure -- noted, not gated.
      if (movedThisRun) {
        console.log(`    (moved during this run -- expected for an open month, not treated as a failure)`);
      }
      continue;
    }

    if (movedThisRun) {
      failures.push(`${m.label} revenue moved during this run: ${before} -> ${r.totalRevenue}.`);
    }
    if (r.totalRevenue !== m.knownRevenue) {
      failures.push(`${m.label} revenue does not match the known-good figure: got ${r.totalRevenue}, expected ${m.knownRevenue}.`);
    }
  }
  if (!failures.some(f => f.includes("revenue"))) {
    console.log("  Revenue unchanged, to the dong, on every gated month.");
  }

  if (failures.length > 0) {
    console.log(`\nTASK 4 FAILED VERIFICATION -- do not treat as done. ${failures.length} check(s) failed:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log("\nAll post-write checks passed.");
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
