import * as dotenv from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { auditMacCogsDrift } from "../lib/mac-cogs-audit";
import {
  assessTask3BaselineLocks,
  buildTask3RecoveryPlan,
  verifyTask3RecoveryState,
} from "../lib/task-3-recovery";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const BASELINE_PATH = "docs/audits/2026-07-09-mac-drift-baseline-lines.json";
const INVESTIGATION_PATH = "docs/audits/2026-07-13-task-3.3-drift-investigation.json";
const OUTPUT_PATH = "docs/audits/2026-07-13-task-3-recovery-verification.json";
const RUN_ID = "TASK-3-E3-SELECTIVE-2026-07-13";
const EXPECTED_MISMATCHES = 130;
const EXPECTED_AUDIT_TOTAL_DELTA = 120715;
const EXPECTED_LINE_DELTA = 120716;

async function main(): Promise<void> {
  const plan = buildTask3RecoveryPlan({
    baselineRaw: readFileSync(BASELINE_PATH, "utf8"),
    investigationRaw: readFileSync(INVESTIGATION_PATH, "utf8"),
    runId: RUN_ID,
  });
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
    supabase.from("data_recovery_changes").select("*").eq("run_id", RUN_ID),
  ]);
  if (locksResult.error) throw new Error(`Read audit baseline locks: ${locksResult.error.message}`);
  if (recoveryResult.error) throw new Error(`Read recovery audit rows: ${recoveryResult.error.message}`);
  assessTask3BaselineLocks(plan.locks, locksResult.data || []);

  const drift = auditMacCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });
  const baselineIds = new Set(plan.locks.map(lock => lock.order_line_id));
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
  if (drift.totalDelta !== EXPECTED_AUDIT_TOTAL_DELTA) {
    throw new Error(`Post-recovery audit delta is ${drift.totalDelta}, expected 120715`);
  }

  writeJson(OUTPUT_PATH, {
    generated_at: new Date().toISOString(),
    run_id: RUN_ID,
    source_hash: plan.source_hash,
    audit_total_delta_vnd: drift.totalDelta,
    ...state,
    recovery_audit_row_count: (recoveryResult.data || []).length,
  });
  console.log("=== TASK 3 E3 POST-RECOVERY VERIFICATION (READ ONLY) ===");
  console.log(`Recovered lines:       ${state.recoveredLineCount}`);
  console.log(`Untouched lines:       ${state.untouchedLineCount}`);
  console.log(`Mismatched lines:      ${state.mismatchLineCount}`);
  console.log(`Audit total delta:     ${drift.totalDelta} VND`);
  console.log(`Mismatch-line delta:   ${state.mismatchLineDeltaVnd} VND`);
  console.log(`Recovery audit rows:   ${(recoveryResult.data || []).length}`);
  console.log(`Verification artifact: ${OUTPUT_PATH}`);
  console.log("No database rows were written.");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
