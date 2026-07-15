import { createHash } from "node:crypto";
import * as dotenv from "dotenv";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { auditMacCogsDrift } from "../lib/mac-cogs-audit";
import { isRecoveryRunId } from "../lib/recovery-snapshot";
import {
  assertAuditBaselineTriggerBlocked,
  assessTask3CohortDrift,
  assessTask3BaselineLocks,
  buildTask3RecoveryPlan,
  buildTask3SnapshotSelection,
  normalizeTask3SnapshotLinesForAudit,
  partitionTask3RecoveryLocks,
  resolveTask3RunId,
  verifyTask3SnapshotFiles,
  verifyTask3RecoveryState,
} from "../lib/task-3-recovery";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const BASELINE_PATH = "docs/audits/2026-07-09-mac-drift-baseline-lines.json";
const INVESTIGATION_PATH = "docs/audits/2026-07-13-task-3.3-drift-investigation.json";
const OUTPUT_PATH = "docs/audits/2026-07-13-task-3-recovery-verification.json";
const EXPECTED_MISMATCHES = 130;
const EXPECTED_LINE_DELTA = 120716;
const BASELINE_CUTOFF = "2026-07-02T23:59:59.999Z";

async function main(): Promise<void> {
  const snapshotId = getArgValue("--snapshot-id");
  const requestedRunId = getArgValue("--run-id");
  if (snapshotId && !requestedRunId) {
    verifyTargetedSnapshot(snapshotId);
    return;
  }

  const runId = resolveTask3RunId(process.argv.slice(2));
  if (!snapshotId) {
    throw new Error("--snapshot-id is required for cohort pre/post verification");
  }
  if (snapshotId !== runId) {
    throw new Error("Task 3 snapshot ID must match the recovery run ID");
  }
  if (!process.argv.includes("--verify-trigger")) {
    throw new Error("--verify-trigger is required for the expected-blocked no-op update");
  }

  const investigationRaw = readFileSync(INVESTIGATION_PATH, "utf8");
  const plan = buildTask3RecoveryPlan({
    baselineRaw: readFileSync(BASELINE_PATH, "utf8"),
    investigationRaw,
    runId,
  });
  const selection = buildTask3SnapshotSelection(plan, investigationRaw);
  verifyTargetedSnapshot(snapshotId);
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  const [orders, lines, ledger, recipes, semiProducts, locksResult, recoveryResult] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    supabase.from("audit_baseline_locks").select("*"),
    supabase.from("data_recovery_changes").select("*").eq("run_id", runId),
  ]);
  if (locksResult.error) throw new Error(`Read audit baseline locks: ${locksResult.error.message}`);
  if (recoveryResult.error) throw new Error(`Read recovery audit rows: ${recoveryResult.error.message}`);
  if (assessTask3BaselineLocks(plan.locks, locksResult.data || []) !== "MATCHED") {
    throw new Error("Task 3 baseline locks are unexpectedly empty");
  }

  const drift = auditMacCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });
  const baselineIds = new Set(plan.locks.map(lock => lock.order_line_id));
  const selectedIds = new Set(plan.changes.map(change => change.line_id));
  const baselineLiveLines = (lines as Array<{ id?: string; cost_at_sale?: unknown }>)
    .filter(line => baselineIds.has(String(line.id || "")))
    .map(line => ({ id: String(line.id), cost_at_sale: line.cost_at_sale }));
  const state = verifyTask3RecoveryState({
    plan,
    liveLines: baselineLiveLines,
    mismatchLineIds: drift.lineMismatches.map(line => line.line_id),
    recoveryRows: (recoveryResult.data || []) as any[],
  });
  if (state.mismatchLineCount !== EXPECTED_MISMATCHES) {
    throw new Error(`Post-recovery mismatches are ${state.mismatchLineCount}, expected 130`);
  }
  if (state.mismatchLineDeltaVnd !== EXPECTED_LINE_DELTA) {
    throw new Error(`Post-recovery line delta is ${state.mismatchLineDeltaVnd}, expected 120716`);
  }

  const liveById = new Map(baselineLiveLines.map(line => [line.id, Number(line.cost_at_sale)]));
  const { recoveredLocks, untouchedLocks } = partitionTask3RecoveryLocks(plan);
  const recoveredMismatches = recoveredLocks.filter(lock =>
    liveById.get(lock.order_line_id) !== lock.expected_cost_at_sale
  );
  const untouchedChanges = untouchedLocks.filter(lock =>
    liveById.get(lock.order_line_id) !== lock.stored_cost_at_sale
  );
  if (recoveredMismatches.length !== 0) {
    throw new Error(`Recovered-line mismatches: ${recoveredMismatches.length}`);
  }
  if (untouchedChanges.length !== 0) {
    throw new Error(`Non-recovered lines changed: ${untouchedChanges.length}`);
  }

  const bundleDirectory = resolve(process.cwd(), "recovery-snapshots", snapshotId);
  const snapshotOrders = JSON.parse(readFileSync(
    join(bundleDirectory, "canonical", "supabase", "orders_v2.json"),
    "utf8",
  ));
  const snapshotLines = normalizeTask3SnapshotLinesForAudit(JSON.parse(readFileSync(
    join(bundleDirectory, "canonical", "supabase", "order_lines_v2.json"),
    "utf8",
  )));
  const snapshotLedger = JSON.parse(readFileSync(
    join(bundleDirectory, "canonical", "supabase", "stock_ledger.json"),
    "utf8",
  ));
  const preCohortDrift = auditMacCogsDrift({
    orders: snapshotOrders,
    lines: snapshotLines as any[],
    ledger: snapshotLedger,
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });
  const selectedOrderIds = new Set(selection.orderIds);
  const postCohortDrift = auditMacCogsDrift({
    orders: (orders as any[]).filter(order => selectedOrderIds.has(String(order.id || ""))),
    lines: (lines as any[]).filter(line => selectedIds.has(String(line.id || ""))),
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });
  console.log("Check 5 diagnostic pre cohort:", JSON.stringify({
    eligible_orders: preCohortDrift.eligibleOrderCount,
    eligible_lines: preCohortDrift.eligibleLineCount,
    stored_cogs: preCohortDrift.totalStoredCogs,
    expected_cogs: preCohortDrift.totalExpectedCogs,
    delta_vnd: preCohortDrift.totalDelta,
    mismatches: preCohortDrift.mismatchedLineCount,
    warnings: preCohortDrift.warnings.length,
  }));
  console.log("Check 5 diagnostic post cohort:", JSON.stringify({
    eligible_orders: postCohortDrift.eligibleOrderCount,
    eligible_lines: postCohortDrift.eligibleLineCount,
    stored_cogs: postCohortDrift.totalStoredCogs,
    expected_cogs: postCohortDrift.totalExpectedCogs,
    delta_vnd: postCohortDrift.totalDelta,
    mismatches: postCohortDrift.mismatchedLineCount,
    warnings: postCohortDrift.warnings.length,
  }));
  const cohortDrift = assessTask3CohortDrift(
    preCohortDrift.totalDelta,
    postCohortDrift.totalDelta,
  );

  const insideMismatches = drift.lineMismatches.filter(line => baselineIds.has(line.line_id));
  const outsideMismatches = drift.lineMismatches.filter(line => !baselineIds.has(line.line_id));
  const outsideBeforeOrAtCutoff = outsideMismatches.filter(line => line.created_at <= BASELINE_CUTOFF);
  const outsideAfterCutoff = outsideMismatches.filter(line => line.created_at > BASELINE_CUTOFF);
  const outsideDates = outsideMismatches.map(line => line.created_at).sort();

  const triggerLine = plan.changes[0];
  const triggerCost = liveById.get(triggerLine.line_id);
  const triggerResult = await supabase
    .from("order_lines_v2")
    .update({ cost_at_sale: triggerCost })
    .eq("id", triggerLine.line_id)
    .select("id");
  const triggerMessage = assertAuditBaselineTriggerBlocked(triggerResult.error);

  const recoveredSamples = recoveredLocks.slice(0, 5).map(lock => ({
    line_id: lock.order_line_id,
    actual_cost_at_sale: liveById.get(lock.order_line_id),
    expected_cost_at_sale: lock.expected_cost_at_sale,
  }));
  const untouchedSamples = untouchedLocks.slice(0, 5).map(lock => ({
    line_id: lock.order_line_id,
    actual_cost_at_sale: liveById.get(lock.order_line_id),
    original_cost_at_sale: lock.stored_cost_at_sale,
  }));

  writeJson(OUTPUT_PATH, {
    generated_at: new Date().toISOString(),
    run_id: runId,
    source_hash: plan.source_hash,
    checks: {
      recovered_line_mismatches: recoveredMismatches.length,
      non_recovered_lines_changed: untouchedChanges.length,
      recovery_audit_row_count: (recoveryResult.data || []).length,
      trigger_blocked_message: triggerMessage,
      cohort_drift: cohortDrift,
      current_live_drift: {
        total_mismatches: drift.mismatchedLineCount,
        total_delta_vnd: drift.totalDelta,
        locked_mismatches: insideMismatches.length,
        outside_locked_cohort: outsideMismatches.length,
        outside_after_cutoff: outsideAfterCutoff.length,
        outside_before_or_at_cutoff: outsideBeforeOrAtCutoff.length,
        earliest_outside_mismatch: outsideDates[0] || null,
        latest_outside_mismatch: outsideDates.at(-1) || null,
      },
    },
    recovered_samples: recoveredSamples,
    untouched_samples: untouchedSamples,
    ...state,
  });
  console.log("=== TASK 3 E3 COHORT-ISOLATED VERIFICATION ===");
  console.log(`Check 1 recovered mismatches:      ${recoveredMismatches.length}`);
  console.log(`Check 2 non-recovered changed:     ${untouchedChanges.length}`);
  console.log(`Check 3 recovery audit rows:       ${(recoveryResult.data || []).length}`);
  console.log(`Check 4 trigger status:            BLOCKED`);
  console.log(`Check 4 trigger message:           ${triggerMessage}`);
  console.log(`Check 5 pre cohort drift:          ${cohortDrift.preDeltaVnd} VND`);
  console.log(`Check 5 post cohort drift:         ${cohortDrift.postDeltaVnd} VND`);
  console.log(`Check 5 recovery effect:           ${cohortDrift.effectVnd} VND`);
  console.log(`Check 5 current full-live drift:   ${drift.totalDelta} VND`);
  console.log(`Check 6 full-live mismatches:      ${drift.mismatchedLineCount}`);
  console.log(`Check 6 locked mismatches:         ${insideMismatches.length}`);
  console.log(`Check 6 outside locked cohort:     ${outsideMismatches.length}`);
  console.log(`Check 6 outside after cutoff:      ${outsideAfterCutoff.length}`);
  console.log(`Check 6 outside <= cutoff:         ${outsideBeforeOrAtCutoff.length}`);
  console.log(`Check 6 outside date range:        ${outsideDates[0] || "n/a"} -> ${outsideDates.at(-1) || "n/a"}`);
  console.log(`Recovered samples: ${JSON.stringify(recoveredSamples)}`);
  console.log(`Untouched samples: ${JSON.stringify(untouchedSamples)}`);
  console.log(`Verification artifact: ${OUTPUT_PATH}`);
  console.log("No production rows were changed; the trigger probe was rejected.");
}

function verifyTargetedSnapshot(snapshotId: string): void {
  if (!isRecoveryRunId(snapshotId)) {
    throw new Error(`Invalid Task 3 snapshot ID: ${snapshotId}`);
  }
  const baselineRaw = readFileSync(BASELINE_PATH, "utf8");
  const investigationRaw = readFileSync(INVESTIGATION_PATH, "utf8");
  const plan = buildTask3RecoveryPlan({ baselineRaw, investigationRaw, runId: snapshotId });
  const selection = buildTask3SnapshotSelection(plan, investigationRaw);
  const bundleDirectory = resolve(process.cwd(), "recovery-snapshots", snapshotId);
  const files = Object.fromEntries(
    listFiles(bundleDirectory).map(filePath => [
      relative(bundleDirectory, filePath).split(sep).join("/"),
      readFileSync(filePath, "utf8"),
    ]),
  );
  const verification = verifyTask3SnapshotFiles({ files, snapshotId, plan, selection });
  const manifestSha256 = createHash("sha256")
    .update(files["manifest.json"])
    .digest("hex");

  console.log("=== TASK 3 TARGETED SNAPSHOT VERIFICATION (READ ONLY) ===");
  console.log(`Snapshot ID:          ${snapshotId}`);
  console.log(`Manifest SHA-256:    ${manifestSha256}`);
  console.log(`Files checked:       ${verification.checkedFiles}`);
  console.log(`Order headers:       ${verification.orderCount}`);
  console.log(`Order lines:         ${verification.orderLineCount}`);
  console.log(`Ledger rows:         ${verification.ledgerRowCount}`);
  console.log(`Baseline locks:      ${verification.baselineLockCount}`);
  console.log(`Prior recovery rows: ${verification.recoveryChangeCount}`);
  console.log("Status:               VALID");
  console.log("No files or operational data were written.");
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
