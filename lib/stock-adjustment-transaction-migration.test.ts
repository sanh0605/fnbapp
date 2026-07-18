import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/0019_atomic_stock_adjustments.sql"),
  "utf8",
).toLowerCase();

describe("0019 atomic stock adjustments migration", () => {
  it("adds the approved canonical stock-adjustment columns", () => {
    for (const fragment of [
      "item_reference text not null",
      "theoretical_qty numeric",
      "actual_qty numeric",
      "difference numeric",
      "approved_by text",
    ]) {
      expect(sql).toContain(fragment);
    }
  });

  it("submits and approves with the ledger completion condition inside RPCs", () => {
    expect(sql).toContain("function public.submit_stock_adjustment_atomic");
    expect(sql).toContain("function public.approve_stock_adjustment_atomic");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("insert into public.stock_adjustments");
    expect(sql.match(/insert into public\.stock_ledger/g)).toHaveLength(2);
    expect(sql).toContain("already_completed");
    expect(sql).toContain("for update");
  });

  it("limits both RPCs to the service role", () => {
    expect(sql.match(/from anon/g)).toHaveLength(2);
    expect(sql.match(/from authenticated/g)).toHaveLength(2);
    expect(sql.match(/to service_role/g)).toHaveLength(2);
  });
});
