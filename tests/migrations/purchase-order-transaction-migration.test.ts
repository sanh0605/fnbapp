import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/0006_atomic_purchase_order_write.sql",
  ),
  "utf8",
).toLowerCase();

describe("atomic purchase order migration", () => {
  it("allocates purchase order IDs under a transaction-scoped lock", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("from public.purchase_orders");
  });

  it("rejects null payloads before ID allocation or writes", () => {
    const validationPosition = migration.indexOf(
      "if p_order is null or jsonb_typeof(p_order) <> 'object'",
    );
    const allocationPosition = migration.indexOf(
      "pg_advisory_xact_lock",
    );

    expect(validationPosition).toBeGreaterThan(-1);
    expect(validationPosition).toBeLessThan(allocationPosition);
    expect(migration).toContain(
      "if p_lines is null or jsonb_typeof(p_lines) <> 'array'",
    );
    expect(migration).toContain(
      "if p_ledger is null or jsonb_typeof(p_ledger) <> 'array'",
    );
  });

  it("replaces the order, lines, and receipt ledger inside one function", () => {
    expect(migration).toContain(
      "create or replace function public.save_purchase_order_atomic",
    );
    expect(migration).toContain("update public.purchase_orders");
    expect(migration).toContain("delete from public.purchase_order_lines");
    expect(migration).toContain("delete from public.stock_ledger");
    expect(migration).toContain("insert into public.purchase_order_lines");
    expect(migration).toContain("insert into public.stock_ledger");
    expect(migration).toContain(
      "get diagnostics v_line_count = row_count",
    );
    expect(migration).toContain(
      "get diagnostics v_ledger_count = row_count",
    );
  });

  it("preserves decimal receipt costs", () => {
    expect(migration).toMatch(/unit_cost numeric/);
    expect(migration).not.toMatch(/unit_cost[\s\S]{0,80}::bigint/);
  });

  it("exposes the function only to the service role", () => {
    expect(migration).toContain("from public");
    expect(migration).toContain("from anon");
    expect(migration).toContain("from authenticated");
    expect(migration).toContain("to service_role");
  });
});
