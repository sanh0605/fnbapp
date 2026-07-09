import * as dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { auditMacCogsDrift } from "../lib/mac-cogs-audit";
import {
  buildMacDriftBaselineReport,
  buildMacDriftRecoveryPlan,
} from "../lib/mac-drift-baseline";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const DEFAULT_RUN_ID = "MAC-DRIFT-BASELINE-2026-07-09";
const PLAN_PATH = "docs/audits/2026-07-09-mac-drift-recovery-plan.json";
const BASELINE_DOCUMENT_DATE = "2026-07-02T23:59:59.999Z";

function fmtMoney(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString("vi-VN")} VND`;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const runId = getArgValue("--run-id") || DEFAULT_RUN_ID;
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [orders, lines, ledger, recipes, semiProducts, events] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Order_Events"),
  ]);

  const drift = auditMacCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });
  const baseline = buildMacDriftBaselineReport({
    drift,
    orders: orders as any[],
    events: events as any[],
    baselineDocumentDate: BASELINE_DOCUMENT_DATE,
  });
  const plan = buildMacDriftRecoveryPlan({
    runId,
    lines: baseline.lines,
  });

  writeJsonReport(PLAN_PATH, {
    generated_at: new Date().toISOString(),
    mode: apply ? "APPLY" : "DRY-RUN",
    baseline: {
      line_count: baseline.lineCount,
      total_delta: baseline.totalDelta,
      mismatched_line_delta: baseline.mismatchedLineDelta,
      migrated_order_line_count: baseline.migratedOrderCount,
      after_baseline_document_count: baseline.afterBaselineDocumentCount,
      after_baseline_document_delta: baseline.afterBaselineDocumentDelta,
    },
    plan,
  });

  console.log(`=== MAC DRIFT RECOVERY (${apply ? "APPLY" : "DRY RUN"}) ===`);
  console.log(`Run ID:             ${plan.run_id}`);
  console.log(`Source SHA-256:     ${plan.source_hash}`);
  console.log(`Changes:            ${plan.changes.length}`);
  console.log(`Audit total delta:  ${fmtMoney(baseline.totalDelta)}`);
  console.log(`Line delta:         ${fmtMoney(baseline.mismatchedLineDelta)}`);
  console.log(`Plan artifact:      ${PLAN_PATH}`);
  for (const change of plan.changes.slice(0, 20)) {
    console.log(
      [
        change.order_no,
        `line=${change.line_id}`,
        `class=${change.classification}`,
        `old=${change.old_cost_at_sale}`,
        `new=${change.new_cost_at_sale}`,
        `delta=${change.delta_vnd}`,
      ].join(" | "),
    );
  }

  if (!apply) {
    console.log("\nNo database rows were written.");
    console.log("Deploy migration 0012, populate audit_baseline_locks, then re-run with --apply only after approval.");
    return;
  }

  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("apply_mac_drift_recovery", {
    p_run_id: plan.run_id,
    p_source_hash: plan.source_hash,
    p_changes: plan.changes,
  });
  if (error) throw new Error(error.message);
  console.log(`Result: ${JSON.stringify(data)}`);
}

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function writeJsonReport(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
