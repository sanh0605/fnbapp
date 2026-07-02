import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/0007_purchase_cost_recovery.sql",
  ),
  "utf8",
).toLowerCase();

describe("purchase cost recovery migration", () => {
  it("keeps a field-level before and after audit record", () => {
    expect(migration).toContain("create table if not exists public.data_recovery_changes");
    expect(migration).toContain("old_value jsonb not null");
    expect(migration).toContain("new_value jsonb not null");
    expect(migration).toContain("source_hash text not null");
  });

  it("checks the expected old value under a row lock before updating", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("v_actual_unit_cost <> v_old_unit_cost");
    expect(migration).toContain("update public.stock_ledger");
  });

  it("is idempotent and supports transactional rollback", () => {
    expect(migration).toContain("'already_applied', true");
    expect(migration).toContain(
      "create or replace function public.rollback_purchase_cost_recovery",
    );
    expect(migration).toContain("rolled_back_at = now()");
  });

  it("only grants execution to the service role", () => {
    expect(migration).toContain("from public");
    expect(migration).toContain("from anon");
    expect(migration).toContain("from authenticated");
    expect(migration).toContain("to service_role");
  });
});
