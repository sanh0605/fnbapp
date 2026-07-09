import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MAC drift baseline lock migration", () => {
  it("locks audit baselines by order_line_id instead of ledger_id", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0012_mac_drift_baseline_locks.sql"),
      "utf8",
    );

    expect(migration).toContain("create table if not exists public.audit_baseline_locks");
    expect(migration).toContain("order_line_id text primary key");
    expect(migration).toContain("references public.order_lines_v2(id)");
    expect(migration).toContain("prevent_audit_locked_order_line_mutation");
    expect(migration).not.toContain("ledger_id text primary key");
  });

  it("provides an atomic recovery RPC that requires baseline locks", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0012_mac_drift_baseline_locks.sql"),
      "utf8",
    );

    expect(migration).toContain("create or replace function public.apply_mac_drift_recovery");
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('mac-drift-recovery:' || p_run_id))");
    expect(migration).toContain("from public.audit_baseline_locks");
    expect(migration).toContain("set_config('app.mac_drift_recovery', 'on', true)");
    expect(migration).toContain("'order_lines_v2'");
    expect(migration).toContain("'cost_at_sale'");
    expect(migration).toContain("update public.order_lines_v2");
  });
});
