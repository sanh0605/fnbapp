import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

import {
  classifyCogs5PriorWrites,
  type Cogs5AuditChange,
  type Cogs5AuditEvent,
} from "../lib/history-ops/cogs5-pipeline-audit";
import { getSupabaseClient } from "../lib/supabase";

const PAGE_SIZE = 1000;

async function main(): Promise<void> {
  const [events, changes] = await Promise.all([
    loadAllRows<Cogs5AuditEvent>("backdated_ledger_events", "detected_at"),
    loadAllRows<Cogs5AuditChange>("data_recovery_changes", "applied_at"),
  ]);
  const result = classifyCogs5PriorWrites({ events, changes });

  console.log("Mode: READ ONLY (no writes)");
  console.log(JSON.stringify(result, null, 2));
  console.log(
    result.backdatedEventLineCount === 0
      ? "Verdict: no COGS-5 target line had a prior write from a durable backdated-ledger event."
      : "Verdict: at least one COGS-5 target line had a prior durable backdated-ledger-event write; investigate event ordering.",
  );
}

async function loadAllRows<T>(table: string, orderColumn: string): Promise<T[]> {
  const supabase = getSupabaseClient();
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data || []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
