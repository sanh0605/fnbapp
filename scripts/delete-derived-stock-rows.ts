import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Plan C Task 5 (docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md).
 * Deletes every stock_ledger row that is not a PO_RECEIPT (SALES_CONSUME,
 * PRODUCTION_CONSUME, PRODUCTION_YIELD, STOCK_ADJUST, EDIT_REVERSAL), and
 * every row in data_recovery_changes. stock_ledger is left holding only
 * what was actually purchased -- "nhap gi xuat do" in its literal form.
 *
 * Unblocked 2026-08-07 by deploying the till (commit 1ec8091, live as
 * fnbapp.vercel.app) and proving Task 3 against a real sale (PHD001336,
 * 18.000d, wrote zero stock_ledger rows). Before that deploy, SALES_CONSUME
 * and PRODUCTION_* were not frozen history -- they were still growing every
 * time the shop sold something, and this task's whole premise (they are
 * dead, safe to delete) was false. It is true now.
 *
 * Triggers checked before writing anything, per fnbapp-bulk-data-change:
 *
 * - stock_ledger: trg_stock_ledger_inventory_balances, AFTER INSERT OR
 *   DELETE OR UPDATE OF item_reference, quantity_change. On DELETE it runs
 *   `inventory_balances.quantity += -old.quantity_change` for the deleted
 *   row's item_reference -- i.e. it undoes exactly what that row
 *   contributed. This is the mechanism, not a side effect to guard against:
 *   deleting a SALES_CONSUME/PRODUCTION_CONSUME row (negative
 *   quantity_change) adds its magnitude back; deleting a PRODUCTION_YIELD
 *   row (positive quantity_change) subtracts it. The trigger must stay
 *   installed through this entire run -- it is what keeps inventory_balances
 *   correct while these rows disappear. This script does not touch it.
 *
 * - data_recovery_changes: prune_data_recovery_changes_trigger, AFTER
 *   INSERT (statement-level), deletes rows older than 30 days FROM
 *   data_recovery_changes itself. It fires on INSERT, not DELETE -- it does
 *   nothing during this script's run. Irrelevant to this deletion, not a
 *   risk to it.
 *
 * Dry-run by default; --apply writes for real.
 */

const MONTH_CHECKS: Array<{ label: string; startDate: string; endDate: string; knownRevenue: number | null }> = [
  { label: "2026-04", startDate: "2026-04-01", endDate: "2026-04-30", knownRevenue: 2190000 },
  { label: "2026-05", startDate: "2026-05-01", endDate: "2026-05-31", knownRevenue: 7675000 },
  { label: "2026-06", startDate: "2026-06-01", endDate: "2026-06-30", knownRevenue: 22157000 },
  { label: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31", knownRevenue: 18661000 },
  { label: "2026-08", startDate: "2026-08-01", endDate: "2026-08-31", knownRevenue: null },
];

// Sữa tươi / Sữa đặc, the plan's named-ingredient arithmetic check. Balance
// only rises here because these two items are raw ingredients purchased via
// PO_RECEIPT and consumed by the derived rows being deleted -- removing the
// consumption adds it back. A semi-product (BTP-*) with no PO_RECEIPT at
// all would fall instead, since only its PRODUCTION_YIELD rows are removed.
const NAMED_INGREDIENT_CHECKS = [
  { itemReference: "NNL-001", label: "Sữa tươi" },
  { itemReference: "ING-003", label: "Sữa đặc" },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { formatNumber } = await import("../lib/format");
  const { getPnLDataV2 } = await import("../app/admin/reports/actions");
  const { batchIds } = await import("./reset-cost-at-sale-core");

  const supabase = getSupabaseClient();

  console.log("Loading data...");
  const ledger = (await findAllNoCache("Stock_Ledger")) as any[];
  const targets = ledger.filter(r => r.transaction_type !== "PO_RECEIPT");
  const kept = ledger.filter(r => r.transaction_type === "PO_RECEIPT");

  const countsByType = new Map<string, number>();
  for (const r of targets) countsByType.set(r.transaction_type, (countsByType.get(r.transaction_type) || 0) + 1);

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log("Scope: every stock_ledger row where transaction_type <> 'PO_RECEIPT'.");
  console.log(`stock_ledger rows to delete: ${targets.length}`);
  for (const [type, count] of [...countsByType.entries()].sort()) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`stock_ledger rows to keep (PO_RECEIPT): ${kept.length}`);

  const { count: recoveryCount, error: recoveryCountError } = await supabase
    .from("data_recovery_changes")
    .select("*", { count: "exact", head: true });
  if (recoveryCountError) throw new Error(`data_recovery_changes count failed: ${recoveryCountError.message}`);
  console.log(`data_recovery_changes rows to delete: ${recoveryCount ?? "?"} (entire table)`);

  console.log(`\nFirst ${Math.min(10, targets.length)} stock_ledger targets:`);
  for (const r of targets.slice(0, 10)) {
    console.log(`  ${r.id} ${r.transaction_type} ${r.item_reference} qty_change=${r.quantity_change} created_at=${r.created_at}`);
  }

  console.log("\nNamed-ingredient arithmetic check (current -> expected after delete):");
  const expectedAfterByItem = new Map<string, number>();
  for (const { itemReference, label } of NAMED_INGREDIENT_CHECKS) {
    const { data: balRow, error: balError } = await supabase
      .from("inventory_balances")
      .select("quantity")
      .eq("item_reference", itemReference)
      .maybeSingle();
    if (balError) throw new Error(`inventory_balances read failed for ${itemReference}: ${balError.message}`);
    const current = Number(balRow?.quantity ?? 0);
    const removedSum = targets
      .filter(r => r.item_reference === itemReference)
      .reduce((sum, r) => sum + Number(r.quantity_change), 0);
    const expectedAfter = current - removedSum;
    expectedAfterByItem.set(itemReference, expectedAfter);
    console.log(
      `  ${label} (${itemReference}): ${formatNumber(current, { withDecimals: true })} -> ` +
        `${formatNumber(expectedAfter, { withDecimals: true })} ` +
        `(rising is correct: consumption is being removed, only purchases remain)`,
    );
  }

  console.log("\nCurrent PnL, every month with sales (unaffected by this task -- stock_ledger holds no money):");
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

  const { count: touchedOldOrdersBefore, error: touchBeforeError } = await supabase
    .from("orders_v2")
    .select("*", { count: "exact", head: true })
    .gte("updated_at", "2026-08-04")
    .lt("created_at", "2026-08-04");
  if (touchBeforeError) throw new Error(`orders_v2 touch check failed: ${touchBeforeError.message}`);
  console.log(
    `\norders_v2 integrity (trg_orders_v2_touch): rows updated since Plan C started that are not new orders: ` +
      `${touchedOldOrdersBefore ?? "?"} (expected 0). This task never writes to orders_v2 -- checked as a baseline.`,
  );

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  const failures: string[] = [];
  const BATCH_SIZE = 100;

  console.log("\nDeleting stock_ledger rows...");
  const ledgerIds: string[] = targets.map(r => r.id);
  let deletedLedger = 0;
  for (const batch of batchIds(ledgerIds, BATCH_SIZE)) {
    const { data, error } = await supabase.from("stock_ledger").delete().in("id", batch).select("id");
    if (error) throw new Error(`stock_ledger batch delete failed: ${error.message}`);
    deletedLedger += data?.length ?? 0;
  }
  console.log(`Deleted ${deletedLedger} stock_ledger rows (expected ${ledgerIds.length}).`);
  if (deletedLedger !== ledgerIds.length) {
    failures.push(`stock_ledger delete shortfall: deleted ${deletedLedger}, expected ${ledgerIds.length}.`);
  }

  console.log("\nDeleting data_recovery_changes (entire table)...");
  const { error: recoveryDeleteError } = await supabase
    .from("data_recovery_changes")
    .delete()
    .not("run_id", "is", null);
  if (recoveryDeleteError) throw new Error(`data_recovery_changes delete failed: ${recoveryDeleteError.message}`);
  console.log("Delete issued.");

  console.log("\nRe-reading end state...");

  let stillNonPoReceipt = 0;
  for (const batch of batchIds(ledgerIds, BATCH_SIZE)) {
    const { count, error } = await supabase
      .from("stock_ledger")
      .select("id", { count: "exact", head: true })
      .in("id", batch);
    if (error) throw new Error(`stock_ledger verify failed: ${error.message}`);
    stillNonPoReceipt += count ?? 0;
  }
  console.log(`  Deleted stock_ledger ids still present: ${stillNonPoReceipt} (expected 0)`);
  if (stillNonPoReceipt !== 0) {
    failures.push(`${stillNonPoReceipt} deleted stock_ledger ids are still present.`);
  }

  const freshLedger = (await findAllNoCache("Stock_Ledger")) as any[];
  const freshNonPoReceipt = freshLedger.filter(r => r.transaction_type !== "PO_RECEIPT");
  console.log(
    `  Full re-query, stock_ledger where transaction_type <> 'PO_RECEIPT': ${freshNonPoReceipt.length} rows ` +
      "(expected 0; a nonzero count here that was not in the targeted set means a write landed mid-run).",
  );
  if (freshNonPoReceipt.length !== 0) {
    failures.push(`${freshNonPoReceipt.length} non-PO_RECEIPT stock_ledger rows remain in the whole table.`);
  }
  console.log(`  stock_ledger PO_RECEIPT rows remaining: ${freshLedger.length - freshNonPoReceipt.length} (expected ${kept.length})`);
  if (freshLedger.length - freshNonPoReceipt.length !== kept.length) {
    failures.push(`PO_RECEIPT count changed: expected ${kept.length}, found ${freshLedger.length - freshNonPoReceipt.length}.`);
  }

  const { count: recoveryAfter, error: recoveryAfterError } = await supabase
    .from("data_recovery_changes")
    .select("*", { count: "exact", head: true });
  if (recoveryAfterError) throw new Error(`data_recovery_changes recount failed: ${recoveryAfterError.message}`);
  console.log(`  data_recovery_changes rows remaining: ${recoveryAfter ?? "?"} (expected 0)`);
  if ((recoveryAfter ?? 0) !== 0) {
    failures.push(`data_recovery_changes still has ${recoveryAfter} rows after delete.`);
  }

  console.log("\nNamed-ingredient balances after delete:");
  for (const { itemReference, label } of NAMED_INGREDIENT_CHECKS) {
    const { data: balRow, error: balError } = await supabase
      .from("inventory_balances")
      .select("quantity")
      .eq("item_reference", itemReference)
      .maybeSingle();
    if (balError) throw new Error(`inventory_balances re-read failed for ${itemReference}: ${balError.message}`);
    const after = Number(balRow?.quantity ?? 0);
    const expected = expectedAfterByItem.get(itemReference)!;
    const closeEnough = Math.abs(after - expected) < 0.000001;
    console.log(`  ${label} (${itemReference}): ${formatNumber(after, { withDecimals: true })} (expected ${formatNumber(expected, { withDecimals: true })})`);
    if (!closeEnough) {
      failures.push(`${label} (${itemReference}) balance after delete: got ${after}, expected ${expected}.`);
    }
    if (after < 0) {
      failures.push(`${label} (${itemReference}) balance went negative: ${after}. STOP -- a purchase row may have been deleted.`);
    }
  }

  console.log("\nRe-reading PnL for every gated month to confirm revenue unchanged.");
  for (const m of MONTH_CHECKS) {
    const r = await getPnLDataV2({ startDate: m.startDate, endDate: m.endDate });
    const before = revenueBefore.get(m.label)!;
    const movedThisRun = r.totalRevenue !== before;
    console.log(`  ${m.label} revenue: ${formatNumber(r.totalRevenue)}d (before this run: ${formatNumber(before)}d)`);

    if (m.knownRevenue === null) {
      if (movedThisRun) console.log(`    (moved during this run -- expected for an open month, not treated as a failure)`);
      continue;
    }
    if (movedThisRun) {
      failures.push(`${m.label} revenue moved during this run: ${before} -> ${r.totalRevenue}.`);
    }
    if (r.totalRevenue !== m.knownRevenue) {
      failures.push(`${m.label} revenue does not match the known-good figure: got ${r.totalRevenue}, expected ${m.knownRevenue}.`);
    }
  }

  const { count: touchedOldOrdersAfter, error: touchAfterError } = await supabase
    .from("orders_v2")
    .select("*", { count: "exact", head: true })
    .gte("updated_at", "2026-08-04")
    .lt("created_at", "2026-08-04");
  if (touchAfterError) throw new Error(`orders_v2 touch re-check failed: ${touchAfterError.message}`);
  console.log(`\norders_v2 integrity after delete: ${touchedOldOrdersAfter ?? "?"} old rows touched (expected 0).`);
  if ((touchedOldOrdersAfter ?? 0) !== 0) {
    failures.push(`orders_v2 shows ${touchedOldOrdersAfter} old rows touched after this run -- this task should never write to orders_v2.`);
  }

  if (failures.length > 0) {
    console.log(`\nTASK 5 FAILED VERIFICATION -- do not treat as done. ${failures.length} check(s) failed:`);
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
