import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/0042_suppress_backdated_detection_during_rebuild.sql";

describe("migration 0042", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("redefines rebuild_stock_ledger_for_order", () => {
    expect(sql).toContain("function public.rebuild_stock_ledger_for_order");
  });

  it("suppresses backdated detection for the duration of the transaction", () => {
    expect(sql).toContain("set_config('app.mac_drift_recovery', 'on', true)");
  });

  it("keeps the RPC restricted to service_role", () => {
    expect(sql).toContain("revoke all on function");
    expect(sql).toContain("to service_role");
  });
});
