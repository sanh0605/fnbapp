import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  "supabase/migrations/0035_preserve_order_payments_on_edit.sql",
);
const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").toLowerCase()
  : "";

describe("0035 preserve order payments on edit migration", () => {
  it("wraps legacy checkout so direct RPC callers must send integer payment amounts", () => {
    expect(sql).toContain("rename to create_pos_order_atomic_unvalidated_0024");
    expect(sql).toContain("create function public.create_pos_order_atomic(");
    expect(sql).toContain("payment amount must be non-negative integer vnd");
    expect(sql).toContain("create_pos_order_atomic_unvalidated_0024(");
  });

  it("replaces the supersede RPC with an atomic payment-aware signature", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(sql).toMatch(/p_payments jsonb\s*\)/);
    expect(sql).toContain("select public.supersede_order_v2_atomic(");
    expect(sql).toContain("insert into public.order_payments");
    expect(sql).toContain("payment count mismatch");
  });

  it("validates payment ownership, methods, amounts, and exact total", () => {
    expect(sql).toContain("every payment must reference the new order");
    expect(sql).toContain("payment method is invalid");
    expect(sql).toContain("payment amount must be non-negative");
    expect(sql).toContain("does not match order net_total");
  });

  it("keeps the RPC restricted to the service role", () => {
    expect(sql).toContain("from anon");
    expect(sql).toContain("from authenticated");
    expect(sql).toContain("to service_role");
  });
});
