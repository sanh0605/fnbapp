import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { verifySnapshotBundleFiles } from "../lib/recovery-snapshot";
import {
  assessTask3BaselineLocks,
  buildTask3RecoveryPlan,
  resolveSupabasePublicKey,
  type Task3BaselineLock,
} from "../lib/task-3-recovery";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const BASELINE_PATH = "docs/audits/2026-07-09-mac-drift-baseline-lines.json";
const INVESTIGATION_PATH = "docs/audits/2026-07-13-task-3.3-drift-investigation.json";
const PLAN_PATH = "docs/audits/2026-07-13-task-3-recovery-plan.json";
const RUN_ID = "TASK-3-E3-SELECTIVE-2026-07-13";
const EXPECTED_BASELINE_LINES = 170;
const EXPECTED_SELECTED_LINES = 40;
const EXPECTED_TOTAL_DELTA = -933;

async function main(): Promise<void> {
  const applyLocks = process.argv.includes("--apply-locks");
  const rpcPreview = process.argv.includes("--rpc-preview");
  const apply = process.argv.includes("--apply");
  if ([applyLocks, rpcPreview, apply].filter(Boolean).length > 1) {
    throw new Error("Choose only one mode: --apply-locks, --rpc-preview, or --apply");
  }

  const plan = buildTask3RecoveryPlan({
    baselineRaw: readFileSync(BASELINE_PATH, "utf8"),
    investigationRaw: readFileSync(INVESTIGATION_PATH, "utf8"),
    runId: RUN_ID,
  });
  assertFixedScope(plan);
  writeJson(PLAN_PATH, {
    generated_at: new Date().toISOString(),
    mode: applyLocks ? "APPLY_LOCKS" : apply ? "APPLY" : rpcPreview ? "RPC_PREVIEW" : "LOCAL_PREVIEW",
    ...plan,
  });
  printPlan(plan);

  if (!applyLocks && !rpcPreview && !apply) {
    console.log("\nNo database rows were read or written.");
    console.log("Use --apply-locks only after the Phase A production approval.");
    return;
  }

  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  if (applyLocks) {
    const existing = await readBaselineLocks(supabase);
    const state = assessTask3BaselineLocks(plan.locks, existing);
    if (state === "EMPTY") {
      const { error } = await supabase.from("audit_baseline_locks").insert(plan.locks);
      if (error) throw new Error(`Insert audit baseline locks: ${error.message}`);
    }
    const verified = await readBaselineLocks(supabase);
    if (assessTask3BaselineLocks(plan.locks, verified) !== "MATCHED") {
      throw new Error("Audit baseline lock verification failed");
    }
    await verifyAnonCannotReadLocks();
    console.log(`Lock result: ${state === "EMPTY" ? "INSERTED" : "ALREADY_MATCHED"}`);
    console.log(`Verified locks: ${verified.length}`);
    console.log("Anonymous audit_baseline_locks read: DENIED");
    return;
  }

  if (apply) {
    const snapshotId = getArgValue("--snapshot-id");
    if (!snapshotId) {
      throw new Error("--apply requires --snapshot-id from a verified pre-recovery snapshot");
    }
    verifySnapshot(plan.source_hash, snapshotId);
  }

  const { data, error } = await supabase.rpc("apply_mac_drift_recovery", {
    p_run_id: plan.run_id,
    p_source_hash: plan.source_hash,
    p_changes: plan.changes,
    p_dry_run: !apply,
  });
  if (error) throw new Error(`apply_mac_drift_recovery: ${error.message}`);
  assertRpcResult(data, apply);
  console.log(`RPC result: ${JSON.stringify(data, null, 2)}`);
  if (!apply) console.log("No database rows were written by RPC preview.");
}

function assertFixedScope(plan: {
  baseline_line_count: number;
  selected_line_count: number;
  total_delta_vnd: number;
}): void {
  if (
    plan.baseline_line_count !== EXPECTED_BASELINE_LINES
    || plan.selected_line_count !== EXPECTED_SELECTED_LINES
    || plan.total_delta_vnd !== EXPECTED_TOTAL_DELTA
  ) {
    throw new Error(
      `Task 3 fixed scope changed: locks=${plan.baseline_line_count}, changes=${plan.selected_line_count}, delta=${plan.total_delta_vnd}`,
    );
  }
}

async function readBaselineLocks(supabase: any): Promise<Task3BaselineLock[]> {
  const { data, error } = await supabase
    .from("audit_baseline_locks")
    .select("order_line_id,locked_by,reason,source_hash,stored_cost_at_sale,expected_cost_at_sale,delta_vnd")
    .order("order_line_id", { ascending: true });
  if (error) throw new Error(`Read audit baseline locks: ${error.message}`);
  return (data || []) as Task3BaselineLock[];
}

async function verifyAnonCannotReadLocks(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = resolveSupabasePublicKey(process.env);
  if (!url || !key) throw new Error("Missing Supabase anon configuration for RLS verification");
  const anon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await anon.from("audit_baseline_locks").select("order_line_id").limit(1);
  if (!error) {
    throw new Error("Anonymous role unexpectedly read audit_baseline_locks");
  }
}

function assertRpcResult(data: any, apply: boolean): void {
  if (!data || data.run_id !== RUN_ID) throw new Error("Recovery RPC returned an unexpected run ID");
  if (data.already_applied) {
    if (!apply) throw new Error("Recovery was already applied before the requested preview");
    return;
  }
  if (Number(data.change_count) !== EXPECTED_SELECTED_LINES) {
    throw new Error(`Recovery RPC returned ${data.change_count} changes, expected 40`);
  }
  if (Number(data.total_delta_vnd) !== EXPECTED_TOTAL_DELTA) {
    throw new Error(`Recovery RPC delta is ${data.total_delta_vnd}, expected -933`);
  }
  if (!Array.isArray(data.preview) || data.preview.length !== EXPECTED_SELECTED_LINES) {
    throw new Error("Recovery RPC did not return the exact 40-line preview");
  }
  if (Boolean(data.dry_run) === apply) {
    throw new Error("Recovery RPC returned the wrong dry-run mode");
  }
}

function verifySnapshot(sourceHash: string, snapshotId: string): void {
  if (!/^recovery-\d{8}T\d{9}Z$/.test(snapshotId)) {
    throw new Error(`Invalid recovery snapshot ID: ${snapshotId}`);
  }
  const bundleDirectory = resolve(process.cwd(), "recovery-snapshots", snapshotId);
  const files = Object.fromEntries(
    listFiles(bundleDirectory).map(filePath => [
      relative(bundleDirectory, filePath).split(sep).join("/"),
      readFileSync(filePath, "utf8"),
    ]),
  );
  const verification = verifySnapshotBundleFiles(files);
  if (!verification.valid) {
    throw new Error(`Recovery snapshot integrity failed: ${verification.errors.join("; ")}`);
  }
  const manifest = JSON.parse(files["manifest.json"]) as {
    sourceHash?: string;
  };
  if (manifest.sourceHash !== sourceHash) {
    throw new Error("Recovery snapshot source hash does not match the Task 3 baseline");
  }
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

function printPlan(plan: ReturnType<typeof buildTask3RecoveryPlan>): void {
  console.log("=== TASK 3 E3 SELECTIVE RECOVERY ===");
  console.log(`Mode:               ${process.argv.includes("--apply") ? "APPLY" : process.argv.includes("--apply-locks") ? "APPLY LOCKS" : process.argv.includes("--rpc-preview") ? "RPC PREVIEW" : "LOCAL PREVIEW"}`);
  console.log(`Run ID:             ${plan.run_id}`);
  console.log(`Source SHA-256:     ${plan.source_hash}`);
  console.log(`Baseline locks:     ${plan.baseline_line_count}`);
  console.log(`Selected changes:   ${plan.selected_line_count}`);
  console.log(`Total delta:        ${plan.total_delta_vnd} VND`);
  console.log(`Plan artifact:      ${PLAN_PATH}`);
  for (const change of plan.changes) {
    console.log(
      `${change.line_id} | order=${change.order_no} | current=${change.old_cost_at_sale} | expected=${change.new_cost_at_sale} | delta=${change.delta_vnd}`,
    );
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
