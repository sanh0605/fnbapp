import * as dotenv from "dotenv";
import { getSupabaseClient } from "../lib/supabase";
import { recomputeEventDryRun } from "../lib/backdated-ledger/recompute-event";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type StepStatus = "PASS" | "FAIL" | "INFO";

type Step = {
  name: string;
  status: StepStatus;
  detail?: string;
};

type BackdatedLedgerEventRow = {
  id: string;
  stock_ledger_id: string;
  effective_timestamp: string;
  visibility_timestamp: string;
  source_table: string;
  source_id: string;
  item_reference: string;
  quantity_change: string | number;
  unit_cost: string | number;
  status: string;
};

const BACKDATE_MINUTES = 60;
const WAIT_FOR_TRIGGER_MS = 300;

const steps: Step[] = [];

async function main(): Promise<void> {
  assertEnv();

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const testLedgerId = `STK-TEST-PHASEE-${runId}`;
  const testItem = `TEST-PHASEE-${runId}`;
  const testPoId = `PO-TEST-PHASEE-${runId}`;
  const backdatedAt = new Date(Date.now() - BACKDATE_MINUTES * 60 * 1000).toISOString();
  let insertedEventId = "";

  console.log("=== Task 3.2 Phase E: Integration Smoke Test ===\n");
  console.log(`Test ledger ID: ${testLedgerId}`);
  console.log(`Test item: ${testItem}`);
  console.log(`Test PO: ${testPoId}`);
  console.log(`Backdate: ${BACKDATE_MINUTES} minutes\n`);

  try {
    const supabase = getSupabaseClient();

    printSection("Step 1: Insert backdated stock_ledger row");
    const { error: insertError } = await supabase.from("stock_ledger").insert({
      id: testLedgerId,
      item_reference: testItem,
      transaction_type: "PO_RECEIPT",
      quantity_change: 10,
      unit_cost: 5000,
      reference_id: testPoId,
      source: "purchase_orders",
      created_at: backdatedAt,
    });
    record(
      "Insert stock_ledger",
      !insertError,
      insertError?.message || testLedgerId,
    );

    await sleep(WAIT_FOR_TRIGGER_MS);

    printSection("Step 2: Verify trigger fired");
    const events = await fetchEventsBySourceId(testPoId);
    record("Trigger fired", events.length === 1, `event_count=${events.length}`);

    const event = events[0];
    if (event) {
      insertedEventId = event.id;
      recordInfo("Event ID", event.id);
      record("Event status is PENDING", event.status === "PENDING", event.status);
      record("Effective timestamp matches insert", sameInstant(event.effective_timestamp, backdatedAt), event.effective_timestamp);
      record(
        "Visibility timestamp is after effective timestamp",
        timestampMs(event.visibility_timestamp) > timestampMs(event.effective_timestamp),
        event.visibility_timestamp,
      );
      record("Item reference matches synthetic item", event.item_reference === testItem, event.item_reference);
      record("Quantity change is 10", Number(event.quantity_change) === 10, String(event.quantity_change));
      record("Unit cost is 5000", Number(event.unit_cost) === 5000, String(event.unit_cost));
    } else {
      recordFail("Event field verification", "trigger did not create an event row");
    }

    printSection("Step 3: Dry-run recompute");
    if (insertedEventId) {
      const plan = await recomputeEventDryRun(insertedEventId);
      record("Dry-run succeeded", true, `event_id=${plan.event_id}`);
      record("Plan event_id matches event", plan.event_id === insertedEventId, plan.event_id);
      record("Run ID uses backdated event ID", plan.run_id === `backdated-${insertedEventId}`, plan.run_id);
      record("Source hash is SHA-256", /^[a-f0-9]{64}$/.test(plan.source_hash), plan.source_hash);
      record("Expected 0 affected lines", plan.affected_lines.length === 0, `affected_lines=${plan.affected_lines.length}`);
      record("Expected 0 changes", plan.changes.length === 0, `changes=${plan.changes.length}`);
    } else {
      recordFail("Dry-run recompute", "skipped because event_id is unavailable");
    }
  } catch (error) {
    recordFail("Unhandled verification error", errorMessage(error));
  } finally {
    printSection("Step 4: Cleanup");
    await cleanup(testPoId, testLedgerId);
    printSummaryAndExit();
  }
}

function assertEnv(): void {
  const hasUrl = Boolean(process.env.SUPABASE_URL);
  const hasSecret = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasUrl || !hasSecret) {
    throw new Error("Missing SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }
}

async function fetchEventsBySourceId(sourceId: string): Promise<BackdatedLedgerEventRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("backdated_ledger_events")
    .select("*")
    .eq("source_id", sourceId);
  if (error) throw new Error(`fetch backdated_ledger_events: ${error.message}`);
  return (data || []) as BackdatedLedgerEventRow[];
}

async function cleanup(testPoId: string, testLedgerId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: deleteEventError } = await supabase
    .from("backdated_ledger_events")
    .delete()
    .eq("source_id", testPoId);
  record("Delete backdated_ledger_events", !deleteEventError, deleteEventError?.message || testPoId);

  const { error: deleteLedgerError } = await supabase
    .from("stock_ledger")
    .delete()
    .eq("id", testLedgerId);
  record("Delete stock_ledger", !deleteLedgerError, deleteLedgerError?.message || testLedgerId);

  try {
    const remainingEvents = await fetchEventsBySourceId(testPoId);
    const { data: remainingLedger, error: ledgerVerifyError } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("id", testLedgerId);
    if (ledgerVerifyError) {
      recordFail("Cleanup verification", `stock_ledger verify failed: ${ledgerVerifyError.message}`);
      return;
    }
    const ledgerCount = remainingLedger?.length || 0;
    const clean = remainingEvents.length === 0 && ledgerCount === 0;
    record(
      "Cleanup verified",
      clean,
      `events=${remainingEvents.length}, stock_ledger=${ledgerCount}`,
    );
  } catch (error) {
    recordFail("Cleanup verification", errorMessage(error));
  }
}

function printSection(title: string): void {
  console.log(`\n--- ${title} ---`);
}

function record(name: string, passed: boolean, detail?: string): void {
  const status: StepStatus = passed ? "PASS" : "FAIL";
  steps.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? `: ${detail}` : ""}`);
}

function recordInfo(name: string, detail: string): void {
  steps.push({ name, status: "INFO", detail });
  console.log(`[INFO] ${name}: ${detail}`);
}

function recordFail(name: string, detail: string): void {
  steps.push({ name, status: "FAIL", detail });
  console.log(`[FAIL] ${name}: ${detail}`);
}

function printSummaryAndExit(): void {
  const passCount = steps.filter(step => step.status === "PASS").length;
  const failCount = steps.filter(step => step.status === "FAIL").length;
  const infoCount = steps.filter(step => step.status === "INFO").length;
  console.log(`\n=== Summary: ${passCount} PASS, ${failCount} FAIL, ${infoCount} INFO ===`);
  process.exitCode = failCount === 0 ? 0 : 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}

function sameInstant(left: string, right: string): boolean {
  return timestampMs(left) === timestampMs(right);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch(error => {
  recordFail("Fatal script error", errorMessage(error));
  printSummaryAndExit();
});
