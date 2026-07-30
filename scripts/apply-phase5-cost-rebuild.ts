import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 5 cost rebuild (docs/superpowers/plans/2026-07-30-phase5-cost-rebuild.md,
 * Task 1-3). Recomputes cost_at_sale from the stock basis Phase 4 rebuilt,
 * using apply_full_history_recovery (migration 0031) unchanged. Writes
 * order_lines_v2.cost_at_sale only -- no stock row is touched, no
 * audit_baseline_lock is read for filtering (Category A is the whole
 * change set; see the plan's "no lock removal" section) and none is removed.
 *
 * Every batch is re-verified against audit_baseline_locks right before use:
 * if any changed line is locked, this script stops and reports rather than
 * silently excluding it -- that is a decision for the owner.
 *
 * Dry-run by default; --apply writes for real, one apply_full_history_recovery
 * call per calendar month (Saigon time) of the affected lines' sale_time.
 *
 * run_id prefix carries a date suffix (phase5-cost-rebuild-v2-2026-07-30-)
 * so a re-run after the Phase 6 recipe-snapshot repair (which changes what
 * this script computes for many of the same months) does not collide with
 * the source-hash guard against this same script's own earlier apply this
 * session. Same reasoning as apply-phase4-stock-rebuild.ts's RUN_ID_PREFIX.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { createHash } = await import("node:crypto");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { buildTrustedPrimitiveLedger, replayFullHistory } = await import("../lib/full-history-recompute");
  const { groupCostChangesByMonth } = await import("../lib/phase5-cost-scope");
  const { toSaigonIsoString } = await import("../lib/datetime");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log("Loading data...");
  const [
    orders, lines, ledger, recipes, semiProducts,
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions,
    baseIngredients, products,
  ] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("UOM_Conversions"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Products"),
  ]) as any[][];

  const nameById = new Map<string, string>();
  for (const i of baseIngredients as any[]) nameById.set(i.id, i.name);
  for (const s of semiProducts as any[]) nameById.set(s.id, s.name);
  const nameOf = (id: string) => nameById.get(id) || id;

  const productNameById = new Map<string, string>();
  for (const p of products as any[]) productNameById.set(p.id, p.name);

  const nonInventoryItems = new Set(
    (baseIngredients as any[])
      .filter(b => b.is_non_inventory === true || b.is_non_inventory === "TRUE")
      .map(b => b.id),
  );

  const supabase = getSupabaseClient();

  console.log("Replaying full history with the fixed engine...");
  const { rows: trustedPrimitives } = buildTrustedPrimitiveLedger({
    purchaseOrders, purchaseOrderLines, purchasedItems, conversions, rawStockLedger: ledger,
  });
  const { lineResults, errors } = replayFullHistory({
    orders, lines, recipes, semiProducts, trustedPrimitives, nonInventoryItems,
  });
  console.log(`Replay: ${lineResults.length} lines, ${errors.length} errors.`);

  // Diagnostic-only second replay, without the non-inventory exclusion, to
  // isolate how much of the cost delta is explained by Phase 4 no longer
  // charging Nuoc/Nuoc soi/Da vien/Trai tac/Trai chanh into drinks that no
  // longer consume them (the plan's standing hypothesis) versus other causes
  // (e.g. the SPM-040 -> La hong tra mapping fix shifting Hong-tra-based
  // product costs). This run's numbers are never written anywhere.
  const { lineResults: lineResultsNoExclusion } = replayFullHistory({
    orders, lines, recipes, semiProducts, trustedPrimitives, nonInventoryItems: new Set(),
  });
  const noExclusionCostByLine = new Map(lineResultsNoExclusion.map(r => [r.line_id, r.computed_cost_at_sale]));

  const lockRows = await supabase.from("audit_baseline_locks").select("order_line_id");
  if (lockRows.error) throw new Error(JSON.stringify(lockRows.error));
  const lockedLineIds = new Set((lockRows.data || []).map((l: any) => l.order_line_id));

  type ChangeCandidate = {
    line_id: string;
    order_id: string;
    order_no: string;
    sale_time: string;
    old_cost_at_sale: number;
    new_cost_at_sale: number;
  };
  const candidates: ChangeCandidate[] = [];
  for (const r of lineResults) {
    const delta = r.computed_cost_at_sale - r.stored_cost_at_sale;
    if (Math.abs(delta) <= 1) continue;
    candidates.push({
      line_id: r.line_id,
      order_id: r.order_id,
      order_no: r.order_no,
      sale_time: r.sale_time,
      old_cost_at_sale: r.stored_cost_at_sale,
      new_cost_at_sale: r.computed_cost_at_sale,
    });
  }
  console.log(`Change candidates (|delta| > 1 dong): ${candidates.length}`);

  // Re-verify the lock condition at run time -- do not trust the spec/plan's
  // recorded B=0/C=0 snapshot. If a locked line appears here, stop: this is
  // an owner decision, not something to silently filter out.
  const lockedInBatch = candidates.filter(c => lockedLineIds.has(c.line_id));
  if (lockedInBatch.length > 0) {
    console.error(`\nSTOP: ${lockedInBatch.length} changed line(s) are audit-baseline locked. This phase must not touch locked lines.`);
    for (const c of lockedInBatch) {
      console.error(`  order ${c.order_no} line ${c.line_id}: stored=${c.old_cost_at_sale} computed=${c.new_cost_at_sale}`);
    }
    console.error("Not filtering these out silently -- report to the owner and get an explicit decision before proceeding.");
    process.exit(1);
  }
  console.log("Lock re-check: 0 changed lines are audit-baseline locked.");

  const orderIdByLine = new Map(candidates.map(c => [c.line_id, c.order_id]));
  const batches = groupCostChangesByMonth(
    candidates.map(c => ({
      line_id: c.line_id,
      sale_time: c.sale_time,
      old_cost_at_sale: c.old_cost_at_sale,
      new_cost_at_sale: c.new_cost_at_sale,
    })),
  );
  console.log(`Monthly batches: ${batches.map(b => `${b.month}(${b.changes.length})`).join(", ")}`);

  // ---- Product-level ranking, by total cost delta ----
  const lineById = new Map((lines as any[]).map(l => [l.id, l]));
  const deltaByProduct = new Map<string, { name: string; delta: number; lineCount: number }>();
  for (const c of candidates) {
    const line = lineById.get(c.line_id);
    const productId = line?.product_id || "(unknown)";
    const name = productNameById.get(productId) || productId;
    const delta = c.new_cost_at_sale - c.old_cost_at_sale;
    const entry = deltaByProduct.get(productId) || { name, delta: 0, lineCount: 0 };
    entry.delta += delta;
    entry.lineCount += 1;
    deltaByProduct.set(productId, entry);
  }
  const productRanking = [...deltaByProduct.entries()]
    .map(([product_id, v]) => ({ product_id, product_name: v.name, total_delta_vnd: v.delta, line_count: v.lineCount }))
    .sort((a, b) => Math.abs(b.total_delta_vnd) - Math.abs(a.total_delta_vnd));

  // ---- Driver analysis: how much of the total delta is explained by the
  // non-inventory exclusion vs other causes (e.g. the SPM-040 remap) ----
  let deltaExplainedByNonInventoryExclusion = 0;
  for (const c of candidates) {
    const withoutExclusion = noExclusionCostByLine.get(c.line_id);
    if (withoutExclusion === undefined) continue;
    // Positive: removing non-inventory consumption lowered this line's cost.
    deltaExplainedByNonInventoryExclusion += withoutExclusion - c.new_cost_at_sale;
  }
  const totalDelta = candidates.reduce((s, c) => s + (c.new_cost_at_sale - c.old_cost_at_sale), 0);

  // ---- Lines moving the other way (cost increased) ----
  const increasedLines = candidates
    .filter(c => c.new_cost_at_sale > c.old_cost_at_sale)
    .map(c => ({
      order_no: c.order_no,
      line_id: c.line_id,
      product_name: productNameById.get(lineById.get(c.line_id)?.product_id) || lineById.get(c.line_id)?.product_id,
      old_cost_at_sale: c.old_cost_at_sale,
      new_cost_at_sale: c.new_cost_at_sale,
      delta: c.new_cost_at_sale - c.old_cost_at_sale,
    }));

  // ---- Month-by-month revenue/COGS table, for ALL completed non-superseded
  // orders in each month (not just the changed lines), so the profit
  // movement is legible against the whole month, not just the delta ----
  const targetOrders = (orders as any[]).filter(o => o.status === "COMPLETED" && !o.superseded_by);
  const orderById = new Map(targetOrders.map(o => [o.id, o]));
  const linesByOrder = new Map<string, any[]>();
  for (const line of lines as any[]) {
    if (!orderById.has(line.order_id)) continue;
    const arr = linesByOrder.get(line.order_id) || [];
    arr.push(line);
    linesByOrder.set(line.order_id, arr);
  }
  const computedCostByLine = new Map(lineResults.map(r => [r.line_id, r.computed_cost_at_sale]));

  type MonthPnl = { month: string; revenue: number; cogs_before: number; cogs_after: number };
  const pnlByMonth = new Map<string, MonthPnl>();
  for (const order of targetOrders) {
    const month = toSaigonIsoString(new Date(order.created_at)).slice(0, 7);
    const entry = pnlByMonth.get(month) || { month, revenue: 0, cogs_before: 0, cogs_after: 0 };
    entry.revenue += Number(order.net_total) || 0;
    for (const line of linesByOrder.get(order.id) || []) {
      const stored = Number(line.cost_at_sale) || 0;
      entry.cogs_before += stored;
      entry.cogs_after += computedCostByLine.get(line.id) ?? stored;
    }
    pnlByMonth.set(month, entry);
  }
  const pnlTable = [...pnlByMonth.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      ...m,
      profit_before: m.revenue - m.cogs_before,
      profit_after: m.revenue - m.cogs_after,
      profit_delta: m.cogs_before - m.cogs_after,
    }));

  // ---- Reconciliation: the P&L table's cogs_after uses every lineResults
  // entry unconditionally (computedCostByLine), but the actual write set
  // (candidates/batches) excludes lines with |delta| <= 1 dong. A handful of
  // lines sit exactly at that boundary (delta === +-1) -- their computed
  // value is reflected in the P&L table above but will NOT be written to
  // order_lines_v2, since apply_full_history_recovery is never called for
  // them. This is why sum(pnlTable.profit_delta) can differ slightly from
  // sum(batches.net_delta): the gap is exactly the sum of these excluded
  // +-1-dong deltas, never anything larger.
  const subThresholdLines = lineResults
    .filter(r => {
      const delta = r.computed_cost_at_sale - r.stored_cost_at_sale;
      return delta !== 0 && Math.abs(delta) <= 1;
    })
    .map(r => ({
      order_no: r.order_no,
      line_id: r.line_id,
      old_cost_at_sale: r.stored_cost_at_sale,
      new_cost_at_sale: r.computed_cost_at_sale,
      delta: r.computed_cost_at_sale - r.stored_cost_at_sale,
    }));
  const subThresholdTotalDelta = subThresholdLines.reduce((s, l) => s + l.delta, 0);
  const pnlTotalProfitDelta = pnlTable.reduce((s, m) => s + m.profit_delta, 0);
  const batchesTotalProfitDelta = -totalDelta;
  const reconciliation = {
    pnl_table_total_profit_delta_vnd: pnlTotalProfitDelta,
    batches_to_write_total_profit_delta_vnd: batchesTotalProfitDelta,
    gap_vnd: pnlTotalProfitDelta - batchesTotalProfitDelta,
    explained_by_sub_threshold_lines_excluded_from_write: subThresholdLines.length,
    sub_threshold_lines_total_delta_vnd: subThresholdTotalDelta,
    note: "The P&L table's cogs_after includes every recomputed line unconditionally. The actual write set (batches below) excludes lines with |delta| <= 1 dong, since apply_full_history_recovery is never called for them. gap_vnd must equal -sub_threshold_lines_total_delta_vnd exactly; if it does not, investigate before proceeding.",
    sub_threshold_lines: subThresholdLines,
  };
  if (reconciliation.gap_vnd !== -subThresholdTotalDelta) {
    console.error(`\nSTOP: reconciliation gap (${reconciliation.gap_vnd}) does not match the sub-threshold total (${-subThresholdTotalDelta}). Investigate before trusting this summary.`);
    process.exit(1);
  }

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Total cost delta (computed - stored), all changed lines: ${totalDelta.toLocaleString()} VND`);
  console.log(`  Of which explained by the non-inventory exclusion: ${deltaExplainedByNonInventoryExclusion.toLocaleString()} VND`);
  console.log(`  Remaining (other causes, e.g. SPM-040 remap): ${(totalDelta - deltaExplainedByNonInventoryExclusion).toLocaleString()} VND`);
  console.log(`Lines moving the other way (cost increased): ${increasedLines.length}`);
  console.log("\nTop products by absolute cost delta:");
  for (const p of productRanking.slice(0, 10)) {
    console.log(`  ${p.product_name}: ${p.total_delta_vnd.toLocaleString()} VND across ${p.line_count} lines`);
  }
  console.log("\nMonth-by-month P&L:");
  for (const m of pnlTable) {
    console.log(`  ${m.month}: revenue=${m.revenue.toLocaleString()} cogs_before=${m.cogs_before.toLocaleString()} cogs_after=${m.cogs_after.toLocaleString()} profit_delta=${m.profit_delta.toLocaleString()}`);
  }
  console.log(`\nReconciliation: P&L table total profit delta = ${pnlTotalProfitDelta.toLocaleString()} VND, batches actually written total = ${batchesTotalProfitDelta.toLocaleString()} VND, gap = ${reconciliation.gap_vnd.toLocaleString()} VND.`);
  console.log(`  Gap fully explained by ${subThresholdLines.length} line(s) sitting exactly at the +-1-dong threshold (excluded from the write set, still reflected in the P&L table's cogs_after).`);

  // ---- Verify the RPC accepts a probe call before running the real loop ----
  const dryRunFailures: string[] = [];
  const applyResults: Array<{ month: string; run_id: string; change_count: number; total_delta_vnd: number; applied: boolean; error?: string }> = [];

  for (const batch of batches) {
    const rpcChanges = batch.changes.map(c => ({
      line_id: c.line_id,
      order_id: orderIdByLine.get(c.line_id),
      old_cost_at_sale: c.old_cost_at_sale,
      new_cost_at_sale: c.new_cost_at_sale,
    }));
    const runId = `phase5-cost-rebuild-v2-2026-07-30-${batch.month}`;
    const sourceHash = createHash("sha256").update(JSON.stringify(rpcChanges)).digest("hex");

    const dryRun = await supabase.rpc("apply_full_history_recovery", {
      p_run_id: runId,
      p_source_hash: sourceHash,
      p_changes: rpcChanges,
      p_dry_run: true,
    });
    if (dryRun.error) {
      dryRunFailures.push(`${batch.month}: ${dryRun.error.message}`);
      continue;
    }

    if (!apply) continue;

    const applyResult = await supabase.rpc("apply_full_history_recovery", {
      p_run_id: runId,
      p_source_hash: sourceHash,
      p_changes: rpcChanges,
      p_dry_run: false,
    });
    if (applyResult.error) {
      applyResults.push({ month: batch.month, run_id: runId, change_count: batch.changes.length, total_delta_vnd: batch.net_delta, applied: false, error: applyResult.error.message });
      continue;
    }
    applyResults.push({ month: batch.month, run_id: runId, change_count: batch.changes.length, total_delta_vnd: batch.net_delta, applied: true });
  }

  console.log(`\nDry-run checks failed: ${dryRunFailures.length}`);
  dryRunFailures.forEach(f => console.log(`  ${f}`));
  if (apply) {
    const appliedCount = applyResults.filter(r => r.applied).length;
    console.log(`\nApplied: ${appliedCount} / ${batches.length} months.`);
    for (const r of applyResults) {
      console.log(`  ${r.month}: ${r.applied ? "OK" : "FAILED"} (${r.change_count} lines, ${r.total_delta_vnd.toLocaleString()} VND)${r.error ? ` -- ${r.error}` : ""}`);
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: apply ? "APPLY" : "DRY_RUN",
    total_lines_changed: candidates.length,
    total_delta_vnd: totalDelta,
    delta_explained_by_non_inventory_exclusion_vnd: deltaExplainedByNonInventoryExclusion,
    delta_other_causes_vnd: totalDelta - deltaExplainedByNonInventoryExclusion,
    monthly_batches: batches.map(b => ({ month: b.month, line_count: b.changes.length, net_delta_vnd: b.net_delta })),
    product_ranking: productRanking,
    lines_moving_the_other_way: increasedLines,
    monthly_pnl: pnlTable,
    pnl_vs_write_reconciliation: reconciliation,
    lock_recheck: { locked_in_batch: lockedInBatch.length },
    dry_run_failures: dryRunFailures,
    apply_results: apply ? applyResults : null,
    no_stock_rows_touched: true,
    no_baseline_lock_removed: true,
  };
  const outPath = path.resolve(
    process.cwd(),
    apply ? "docs/audits/2026-07-30-phase5-cost-apply.json" : "docs/audits/2026-07-30-phase5-cost-dryrun.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${outPath}`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply only after the owner approves this summary.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
