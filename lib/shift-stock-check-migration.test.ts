import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/0033_shift_stock_checks.sql"),
  "utf8",
).toLowerCase();

describe("0033 shift stock checks migration", () => {
  it("creates the shifts and shift_stock_checks tables", () => {
    expect(sql).toContain("create table if not exists public.shifts");
    expect(sql).toContain("create table if not exists public.shift_stock_checks");
    expect(sql).toContain("where status = 'open'");
  });

  it("defines both RPCs with the expected safety mechanisms", () => {
    expect(sql).toContain("function public.open_shift_stock_check_atomic");
    expect(sql).toContain("function public.close_shift_stock_check_atomic");
    expect(sql.match(/pg_advisory_xact_lock/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sql).toContain("for update");
    expect(sql).toContain("a shift is already open");
    expect(sql).toContain("is already closed");
  });

  it("computes theoretical_qty from stock_ledger, never writes to it", () => {
    expect(sql).toContain("from public.stock_ledger where item_reference");
    expect(sql).not.toContain("insert into public.stock_ledger");
  });

  it("limits both tables and both RPCs to the service role", () => {
    expect(sql.match(/from public, anon, authenticated/g)?.length).toBe(4);
    expect(sql.match(/to service_role/g)?.length).toBe(4);
  });
});
