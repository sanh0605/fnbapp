import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0047_pos_atomic_exact_cost.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim().toLowerCase()
  : "";

describe("0047 POS checkout RPCs accept numeric(18,6) cost_at_sale", () => {
  it("exists", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("redefines both create_pos_order_atomic and create_pos_order_atomic_unvalidated_0024", () => {
    // Both already exist (0035, 0040) -- redefining either requires "create
    // or replace", not "create" (which errors on an existing function).
    expect(migration).toContain("create or replace function public.create_pos_order_atomic(");
    expect(migration).toContain("create or replace function public.create_pos_order_atomic_unvalidated_0024(");
  });

  it("the p_lines recordset in the real-logic function now types cost_at_sale as numeric(18,6), not bigint", () => {
    const fnStart = migration.indexOf("create or replace function public.create_pos_order_atomic_unvalidated_0024(");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = migration.slice(fnStart);
    expect(fnBody).toContain("cost_at_sale numeric(18,6),");
    expect(fnBody).not.toMatch(/cost_at_sale bigint/);
  });

  it("changes nothing else in the wrapper -- payment validation logic still present verbatim", () => {
    expect(migration).toContain("payment amount must be non-negative integer vnd and payment fields must be valid");
    expect(migration).toContain("select public.create_pos_order_atomic_unvalidated_0024(");
  });

  it("still restricts the wrapper's execute grant to service_role, and the inner function to nobody (called only internally, per 0035)", () => {
    expect(migration).toContain("grant execute on function public.create_pos_order_atomic(");
    expect(migration).toContain(
      "revoke all on function public.create_pos_order_atomic_unvalidated_0024( text, jsonb, jsonb, jsonb, jsonb, text, jsonb ) from public, anon, authenticated, service_role;",
    );
    expect(migration).not.toContain("grant execute on function public.create_pos_order_atomic_unvalidated_0024(");
  });
});
