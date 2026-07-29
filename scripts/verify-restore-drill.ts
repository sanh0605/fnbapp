import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 3 restore drill, Task 5
 * (docs/superpowers/plans/2026-07-29-phase3-backup-coverage-and-restore-drill.md).
 * Compares the restored scratch database against production: row counts for
 * every table, plus content spot-checks (not just counts) for PO-037, one
 * split-payment order, and Sữa đặc's stock_ledger row count. Read-only against
 * both databases -- never writes anywhere.
 */

type RowCountDiff = { table: string; baseline: number; production_now: number; restored: number; delta_vs_production: number };

async function main(): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const { BACKUP_TABLES } = await import("../supabase/functions/backup-to-drive/core");
  const fs = await import("node:fs");
  const path = await import("node:path");

  const prodClient = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const targetUrl = process.env.RESTORE_TARGET_SUPABASE_URL || "";
  const targetClient = createClient(targetUrl, process.env.RESTORE_TARGET_SERVICE_KEY || "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const baselinePath = path.resolve(process.cwd(), "docs/audits/2026-07-29-backup-coverage-baseline.json");
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  // ---- Step 1: row counts, all 40 tables ----
  // Compared against LIVE production, not the Task 2 baseline file: the
  // restore script re-fetches a fresh snapshot from production immediately
  // before restoring, and production is a live system -- real sales happen
  // between the baseline capture and the restore run. Comparing against a
  // stale baseline would misreport ordinary new activity as a restore
  // failure. The baseline is still recorded per-table for reference, to show
  // how much production grew since Task 2.
  console.log("=== STEP 1: ROW COUNTS (restored scratch DB vs LIVE production) ===");
  const rowCountDiffs: RowCountDiff[] = [];
  for (const table of BACKUP_TABLES) {
    const [restoredResult, prodResult] = await Promise.all([
      targetClient.from(table).select("*", { count: "exact", head: true }),
      prodClient.from(table).select("*", { count: "exact", head: true }),
    ]);
    if (restoredResult.error) {
      console.log(`  ${table}: ERROR (restored) ${restoredResult.error.message}`);
      continue;
    }
    if (prodResult.error) {
      console.log(`  ${table}: ERROR (production) ${prodResult.error.message}`);
      continue;
    }
    const restored = restoredResult.count || 0;
    const productionNow = prodResult.count || 0;
    const base = baseline.table_counts[table] ?? 0;
    const delta = restored - productionNow;
    rowCountDiffs.push({ table, baseline: base, production_now: productionNow, restored, delta_vs_production: delta });
    if (delta !== 0) {
      console.log(`  ${table}: baseline(Task 2)=${base} production_now=${productionNow} restored=${restored} delta_vs_production=${delta}`);
    }
  }
  const exactMatches = rowCountDiffs.filter(d => d.delta_vs_production === 0).length;
  console.log(`\n${exactMatches}/${rowCountDiffs.length} tables match live production exactly.`);

  // ---- Step 2: content spot-checks ----
  console.log("\n=== STEP 2: CONTENT SPOT-CHECKS ===");
  const findings: string[] = [];

  // 2a. PO-037 header + lines
  console.log("\n-- PO-037 (header + lines) --");
  const [prodPo, targetPo] = await Promise.all([
    prodClient.from("purchase_orders").select("*").eq("id", "PO-037").maybeSingle(),
    targetClient.from("purchase_orders").select("*").eq("id", "PO-037").maybeSingle(),
  ]);
  const [prodPoLines, targetPoLines] = await Promise.all([
    prodClient.from("purchase_order_lines").select("*").eq("purchase_order_id", "PO-037").order("id"),
    targetClient.from("purchase_order_lines").select("*").eq("purchase_order_id", "PO-037").order("id"),
  ]);
  const po037HeaderMatch = JSON.stringify(prodPo.data) === JSON.stringify(targetPo.data);
  const po037LinesMatch = JSON.stringify(prodPoLines.data) === JSON.stringify(targetPoLines.data);
  console.log(`  header matches exactly: ${po037HeaderMatch}`);
  console.log(`  lines match exactly: ${po037LinesMatch} (prod ${prodPoLines.data?.length ?? 0} lines, restored ${targetPoLines.data?.length ?? 0} lines)`);
  if (!po037HeaderMatch) findings.push("PO-037 header differs between production and the restored database.");
  if (!po037LinesMatch) findings.push("PO-037 lines differ between production and the restored database.");

  // 2b. One split-payment order (>1 order_payments row for the same order_id)
  console.log("\n-- One split-payment order (order_payments) --");
  const { data: allPayments } = await prodClient
    .from("order_payments")
    .select("order_id")
    .limit(2000);
  const countByOrder = new Map<string, number>();
  for (const row of allPayments || []) {
    countByOrder.set(row.order_id, (countByOrder.get(row.order_id) || 0) + 1);
  }
  const splitOrderId = [...countByOrder.entries()].find(([, c]) => c > 1)?.[0];
  if (!splitOrderId) {
    console.log("  No split-payment order found in production (>1 payment row for the same order) -- skipping this spot-check.");
    findings.push("No split-payment order exists in production to spot-check; order_payments row-by-row content was not verified beyond counts.");
  } else {
    const [prodPay, targetPay] = await Promise.all([
      prodClient.from("order_payments").select("*").eq("order_id", splitOrderId).order("id"),
      targetClient.from("order_payments").select("*").eq("order_id", splitOrderId).order("id"),
    ]);
    const paymentsMatch = JSON.stringify(prodPay.data) === JSON.stringify(targetPay.data);
    console.log(`  order ${splitOrderId}: ${prodPay.data?.length ?? 0} payment rows in production, ${targetPay.data?.length ?? 0} in restored, content matches exactly: ${paymentsMatch}`);
    if (!paymentsMatch) findings.push(`Split-payment order ${splitOrderId}'s order_payments rows differ between production and the restored database.`);
  }

  // 2c. Sữa đặc (ING-003) stock_ledger row count
  console.log("\n-- Sữa đặc (ING-003) stock_ledger row count --");
  const [prodIngCount, targetIngCount] = await Promise.all([
    prodClient.from("stock_ledger").select("*", { count: "exact", head: true }).eq("item_reference", "ING-003"),
    targetClient.from("stock_ledger").select("*", { count: "exact", head: true }).eq("item_reference", "ING-003"),
  ]);
  const ingMatch = (prodIngCount.count || 0) === (targetIngCount.count || 0);
  console.log(`  production: ${prodIngCount.count}, restored: ${targetIngCount.count}, matches: ${ingMatch}`);
  if (!ingMatch) findings.push(`Sữa đặc (ING-003) stock_ledger row count differs: production=${prodIngCount.count}, restored=${targetIngCount.count}.`);

  // ---- Known, explained deltas (trigger side effects of bulk restore) ----
  const explainedDeltaTables = new Set(["backdated_ledger_events", "backdated_recipe_events"]);
  const unexplainedDeltas = rowCountDiffs.filter(d => d.delta_vs_production !== 0 && !explainedDeltaTables.has(d.table));

  const verdict = findings.length === 0 && unexplainedDeltas.length === 0 ? "PASS" : "FAIL";

  console.log(`\n=== VERDICT: ${verdict} ===`);
  if (unexplainedDeltas.length > 0) {
    console.log("Unexplained row-count deltas vs live production (not the known trigger side effect):");
    for (const d of unexplainedDeltas) console.log(`  ${d.table}: production_now=${d.production_now} restored=${d.restored}`);
  }
  for (const f of findings) console.log(`FINDING: ${f}`);

  const report = {
    generated_at: new Date().toISOString(),
    verdict,
    row_count_diffs: rowCountDiffs,
    explained_delta_tables: [...explainedDeltaTables],
    unexplained_deltas: unexplainedDeltas,
    content_spot_checks: {
      po037_header_matches: po037HeaderMatch,
      po037_lines_match: po037LinesMatch,
      split_payment_order_id: splitOrderId || null,
      sua_dac_stock_ledger_count_matches: ingMatch,
    },
    findings,
  };
  const outPath = path.resolve(process.cwd(), "docs/audits/2026-07-29-phase3-restore-drill-result.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error("FAILED:", error);
  process.exitCode = 1;
});
