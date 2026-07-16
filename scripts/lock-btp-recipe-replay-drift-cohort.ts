/**
 * Task 3.7: lock the approved 225-line replay-drift cohort.
 *
 * Default mode is read-only. Production insertion requires --apply and is one
 * bulk PostgREST INSERT statement, which PostgreSQL executes atomically.
 */

import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  BTP_DRIFT_FINAL_LOCK_COUNT,
  assessBtpDriftLockLiveState,
  buildBtpDriftLockPlan,
  type BtpDriftExistingLock,
  type BtpDriftLiveLine,
  type BtpDriftLockPlan,
} from "../lib/btp-drift-lock";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const TASK_34_PATH = "docs/audits/2026-07-15-task-3.4-outside-cohort-investigation.json";
const TASK_36_PATH = "docs/audits/2026-07-15-task-3.6-forward-drift-investigation.json";
const QUERY_CHUNK_SIZE = 100;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const unknownArgs = process.argv.slice(2).filter(arg => arg !== "--apply");
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown arguments: ${unknownArgs.join(", ")}`);
  }

  const plan = buildBtpDriftLockPlan({
    task34Raw: readFileSync(TASK_34_PATH, "utf8"),
    task36Raw: readFileSync(TASK_36_PATH, "utf8"),
  });
  const client = createServiceClient();
  const lineIds = plan.records.map(record => record.line_id);
  const [liveLines, existingTargetLocks, totalExistingLockCount] = await Promise.all([
    readLiveLines(client, lineIds),
    readTargetLocks(client, lineIds),
    readTotalLockCount(client),
  ]);
  const assessment = assessBtpDriftLockLiveState({
    plan,
    liveLines,
    existingTargetLocks,
    totalExistingLockCount,
  });

  printDryRun({ plan, assessment, totalExistingLockCount, apply });
  if (assessment.state === "INVALID") {
    throw new Error(`Task 3.7 validation failed with ${assessment.errors.length} error(s)`);
  }
  if (!apply) {
    console.log("\nDRY-RUN PASS. No database rows were written.");
    console.log("Pause for Claude review before running with --apply.");
    return;
  }

  const beforeCosts = new Map(liveLines.map(line => [line.id, Number(line.cost_at_sale)]));
  if (assessment.state === "READY") {
    const { error } = await client
      .from("audit_baseline_locks")
      .insert(assessment.locks);
    if (error) {
      await inspectFailedInsertState(client, plan);
      throw new Error(
        `Atomic cohort insert failed: ${error.message}. Do not retry automatically; review the reported state with Claude.`,
      );
    }
  } else {
    console.log("Approved cohort is already applied exactly; running verification only.");
  }

  const [verifiedLines, verifiedLocks, verifiedTotal] = await Promise.all([
    readLiveLines(client, lineIds),
    readTargetLocks(client, lineIds),
    readTotalLockCount(client),
  ]);
  const verified = assessBtpDriftLockLiveState({
    plan,
    liveLines: verifiedLines,
    existingTargetLocks: verifiedLocks,
    totalExistingLockCount: verifiedTotal,
  });
  if (verified.state !== "ALREADY_APPLIED" || verified.errors.length > 0) {
    throw new Error(`Post-apply cohort verification failed: ${JSON.stringify(verified.errors)}`);
  }
  if (verifiedTotal !== BTP_DRIFT_FINAL_LOCK_COUNT) {
    throw new Error(`Post-apply lock count is ${verifiedTotal}, expected ${BTP_DRIFT_FINAL_LOCK_COUNT}`);
  }
  verifyCostsUnchanged(beforeCosts, verifiedLines);
  await verifyTriggerBlocksUpdate(client, verifiedLines[0]);

  console.log("\n=== TASK 3.7 APPLY VERIFIED ===");
  console.log(`Cohort rows:          ${verifiedLocks.length}`);
  console.log(`Total lock rows:      ${verifiedTotal}`);
  console.log(`Source SHA-256:       ${plan.source_hash}`);
  console.log(`Unchanged line costs: ${verifiedLines.length}`);
  console.log("Trigger probe:        BLOCKED (audit-baseline locked)");
  console.log("No cost_at_sale value was changed.");
}

function printDryRun(input: {
  plan: BtpDriftLockPlan;
  assessment: ReturnType<typeof assessBtpDriftLockLiveState>;
  totalExistingLockCount: number;
  apply: boolean;
}): void {
  console.log("=== TASK 3.7 BTP RECIPE REPLAY DRIFT COHORT LOCK ===");
  console.log(`Mode:                  ${input.apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Source SHA-256:        ${input.plan.source_hash}`);
  console.log(`Lines in source:       ${input.plan.line_count}`);
  console.log(`Total signed delta:    ${input.plan.total_delta_vnd.toLocaleString("vi-VN")} VND`);
  console.log(`Existing total locks:  ${input.totalExistingLockCount}`);
  console.log(`Existing target locks: ${input.assessment.existing_target_lock_count}`);
  console.log(`State:                 ${input.assessment.state}`);
  console.table(input.plan.bucket_summary);
  if (input.assessment.errors.length > 0) {
    console.log("Validation failures:");
    console.table(input.assessment.errors);
  } else {
    console.log("Validation failures:   0");
    console.log(`Rows to insert:         ${input.assessment.locks.length}`);
    console.log(`Expected final locks:   ${input.assessment.expected_total_after_apply}`);
  }
}

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service credential");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readLiveLines(client: SupabaseClient, lineIds: string[]): Promise<BtpDriftLiveLine[]> {
  const rows: BtpDriftLiveLine[] = [];
  for (const ids of chunks(lineIds, QUERY_CHUNK_SIZE)) {
    const { data, error } = await client
      .from("order_lines_v2")
      .select("id,order_id,cost_at_sale")
      .in("id", ids)
      .order("id", { ascending: true });
    if (error) throw new Error(`Read order lines: ${error.message}`);
    rows.push(...((data || []) as BtpDriftLiveLine[]));
  }
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

async function readTargetLocks(
  client: SupabaseClient,
  lineIds: string[],
): Promise<BtpDriftExistingLock[]> {
  const rows: BtpDriftExistingLock[] = [];
  for (const ids of chunks(lineIds, QUERY_CHUNK_SIZE)) {
    const { data, error } = await client
      .from("audit_baseline_locks")
      .select("order_line_id,locked_by,reason,source_hash,stored_cost_at_sale,expected_cost_at_sale,delta_vnd")
      .in("order_line_id", ids)
      .order("order_line_id", { ascending: true });
    if (error) throw new Error(`Read target locks: ${error.message}`);
    rows.push(...((data || []) as BtpDriftExistingLock[]));
  }
  return rows.sort((left, right) => left.order_line_id.localeCompare(right.order_line_id));
}

async function readTotalLockCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("audit_baseline_locks")
    .select("order_line_id", { count: "exact", head: true });
  if (error) throw new Error(`Count audit locks: ${error.message}`);
  if (count === null) throw new Error("Count audit locks returned null");
  return count;
}

function verifyCostsUnchanged(before: Map<string, number>, after: BtpDriftLiveLine[]): void {
  if (after.length !== before.size) {
    throw new Error(`Post-apply order-line count is ${after.length}, expected ${before.size}`);
  }
  for (const line of after) {
    if (!before.has(line.id) || before.get(line.id) !== Number(line.cost_at_sale)) {
      throw new Error(`cost_at_sale changed unexpectedly for ${line.id}`);
    }
  }
}

async function verifyTriggerBlocksUpdate(
  client: SupabaseClient,
  sample: BtpDriftLiveLine | undefined,
): Promise<void> {
  if (!sample) throw new Error("No locked line is available for trigger verification");
  const { error } = await client
    .from("order_lines_v2")
    .update({ cost_at_sale: Number(sample.cost_at_sale) })
    .eq("id", sample.id);
  if (!error) throw new Error("Audit-baseline trigger unexpectedly allowed a locked no-op UPDATE");
  if (!error.message.toLowerCase().includes("audit-baseline locked")) {
    throw new Error(`Trigger probe failed with unexpected error: ${error.message}`);
  }
}

async function inspectFailedInsertState(client: SupabaseClient, plan: BtpDriftLockPlan): Promise<void> {
  const lineIds = plan.records.map(record => record.line_id);
  const [targetLocks, totalLocks] = await Promise.all([
    readTargetLocks(client, lineIds),
    readTotalLockCount(client),
  ]);
  console.error("Atomic insert error state:");
  console.error(`Target locks present: ${targetLocks.length}/225`);
  console.error(`Total locks present:  ${totalLocks}`);
  console.error("Do not retry automatically.");
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
