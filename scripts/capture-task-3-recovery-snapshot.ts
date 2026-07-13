import { createHash } from "node:crypto";
import * as dotenv from "dotenv";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createSnapshotBundleFiles } from "../lib/recovery-snapshot";
import {
  assessTask3BaselineLocks,
  buildTask3RecoveryPlan,
  buildTask3RecoveryRunId,
  buildTask3SnapshotSelection,
} from "../lib/task-3-recovery";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const BASELINE_PATH = "docs/audits/2026-07-09-mac-drift-baseline-lines.json";
const INVESTIGATION_PATH = "docs/audits/2026-07-13-task-3.3-drift-investigation.json";
async function main(): Promise<void> {
  if (!process.argv.includes("--capture")) {
    console.log("=== TASK 3 PRE-RECOVERY SNAPSHOT (DRY RUN) ===");
    console.log("Targets: 40 order lines, their order headers, relevant ledger items, 40 matching baseline locks.");
    console.log("No sources were read and no files were written.");
    console.log("Pass --capture after Phase A lock verification.");
    return;
  }

  const baselineRaw = readFileSync(BASELINE_PATH, "utf8");
  const investigationRaw = readFileSync(INVESTIGATION_PATH, "utf8");
  const snapshotId = buildTask3RecoveryRunId();
  const plan = buildTask3RecoveryPlan({ baselineRaw, investigationRaw, runId: snapshotId });
  const selection = buildTask3SnapshotSelection(plan, investigationRaw);
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  const [orders, lines, ledger, locks, recoveryChanges] = await Promise.all([
    readRows(supabase, "orders_v2", "id", query => query.in("id", selection.orderIds)),
    readRows(supabase, "order_lines_v2", "id", query => query.in("id", selection.orderLineIds)),
    readRows(supabase, "stock_ledger", "id", query => query.in("item_reference", selection.itemReferences)),
    readRows(supabase, "audit_baseline_locks", "order_line_id", query =>
      query.in("order_line_id", selection.orderLineIds)
    ),
    readRows(supabase, "data_recovery_changes", "row_id", query => query.eq("run_id", snapshotId)),
  ]);

  if (orders.length !== selection.orderIds.length) {
    throw new Error(`Snapshot found ${orders.length}/${selection.orderIds.length} order headers`);
  }
  if (lines.length !== selection.orderLineIds.length) {
    throw new Error(`Snapshot found ${lines.length}/${selection.orderLineIds.length} order lines`);
  }
  if (recoveryChanges.length !== 0) {
    throw new Error("Task 3 recovery already has change-log rows; refusing a pre-recovery snapshot");
  }
  const selectedLineIds = new Set(selection.orderLineIds);
  const selectedLocks = plan.locks.filter(lock => selectedLineIds.has(lock.order_line_id));
  if (assessTask3BaselineLocks(selectedLocks, locks) !== "MATCHED") {
    throw new Error("Snapshot did not find all 40 matching audit baseline locks");
  }
  const expectedByLineId = new Map(plan.changes.map(change => [change.line_id, change]));
  for (const line of lines) {
    const expected = expectedByLineId.get(String(line.id));
    if (!expected || Number(line.cost_at_sale) !== expected.old_cost_at_sale) {
      throw new Error(`Order line ${String(line.id)} changed before snapshot`);
    }
  }

  const files = createSnapshotBundleFiles({
    runId: snapshotId,
    capturedAt: new Date().toISOString(),
    sourceHash: plan.source_hash,
    sheets: {},
    supabase: {
      orders_v2: orders,
      order_lines_v2: lines,
      stock_ledger: ledger,
      audit_baseline_locks: locks,
      data_recovery_changes: recoveryChanges,
    },
  });
  const outputRoot = resolve(process.cwd(), "recovery-snapshots");
  const partialDirectory = join(outputRoot, `.partial-${snapshotId}`);
  const finalDirectory = join(outputRoot, snapshotId);
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(partialDirectory, { recursive: false });
  for (const [relativePath, content] of Object.entries(files)) {
    const outputPath = join(partialDirectory, relativePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, { encoding: "utf8", flag: "wx" });
  }
  renameSync(partialDirectory, finalDirectory);
  const manifestSha256 = createHash("sha256").update(files["manifest.json"]).digest("hex");

  console.log("=== TASK 3 PRE-RECOVERY SNAPSHOT ===");
  console.log(`Snapshot ID:          ${snapshotId}`);
  console.log(`Manifest SHA-256:    ${manifestSha256}`);
  console.log(`Order headers:       ${orders.length}`);
  console.log(`Order lines:         ${lines.length}`);
  console.log(`Relevant items:      ${selection.itemReferences.length}`);
  console.log(`Ledger rows:         ${ledger.length}`);
  console.log(`Baseline locks:      ${locks.length}`);
  console.log(`Prior recovery rows: ${recoveryChanges.length}`);
  console.log(`Output:               ${finalDirectory}`);
  console.log("No operational data was written.");
}

async function readRows(
  supabase: any,
  table: string,
  orderColumn: string,
  filter: (query: any) => any,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  const pageSize = 1000;
  for (let page = 0; ; page += 1) {
    let query = supabase.from(table).select("*");
    query = filter(query).order(orderColumn, { ascending: true });
    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`Snapshot read ${table}: ${error.message}`);
    const pageRows = (data || []) as Array<Record<string, unknown>>;
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
