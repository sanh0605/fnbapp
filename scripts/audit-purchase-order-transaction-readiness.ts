import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { classifyPurchaseOrderRpcProbe } from "../lib/purchase-order-rpc-readiness";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0006_atomic_purchase_order_write.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const normalizedMigration = migration.toLowerCase();
const sourceChecks = [
  "create or replace function public.save_purchase_order_atomic",
  "if p_order is null or jsonb_typeof(p_order) <> 'object'",
  "pg_advisory_xact_lock",
  "delete from public.purchase_order_lines",
  "delete from public.stock_ledger",
  "get diagnostics v_line_count = row_count",
  "get diagnostics v_ledger_count = row_count",
  "to service_role",
];
const missingChecks = sourceChecks.filter(
  check => !normalizedMigration.includes(check),
);
const migrationHash = createHash("sha256")
  .update(migration)
  .digest("hex");

console.log("=== PURCHASE ORDER TRANSACTION READINESS (READ ONLY) ===");
console.log(`Migration: ${migrationPath}`);
console.log(`SHA-256: ${migrationHash}`);
console.log(`Source checks: ${sourceChecks.length - missingChecks.length}/${sourceChecks.length}`);

if (missingChecks.length > 0) {
  console.error(`Missing contracts: ${missingChecks.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Source status: READY");
}

async function probeRemote(): Promise<void> {
  const { getSupabaseClient } = await import("../lib/supabase");
  const { error } = await getSupabaseClient().rpc(
    "save_purchase_order_atomic",
    {
      p_order: [],
      p_lines: [],
      p_ledger: [],
      p_replace_existing: false,
    },
  );
  const result = classifyPurchaseOrderRpcProbe(error);
  console.log(`Remote status: ${result.status}`);
  console.log(`Remote detail: ${result.detail}`);
  if (result.status !== "READY") {
    process.exitCode = 1;
  }
}

if (process.argv.includes("--remote")) {
  await probeRemote();
} else {
  console.log("Remote status: SKIPPED (pass --remote for a non-writing guard probe)");
}

console.log("No data was written.");
