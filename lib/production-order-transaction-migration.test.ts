import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/0018_atomic_production_order.sql"),
  "utf8",
).toLowerCase();

describe("0018_atomic_production_order migration", () => {
  it("persists the canonical production batch in one locked transaction", () => {
    expect(sql).toContain("function public.save_production_order_atomic");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("insert into public.production_orders");
    expect(sql).toContain("semi_product_id, batch_yield, status");
    expect(sql).toContain("insert into public.production_items");
    expect(sql).toContain("insert into public.stock_ledger");
    expect(sql).toContain("production_consume");
    expect(sql).toContain("production_yield");
    expect(sql).toContain("completed_at");
  });

  it("limits execution to the service role", () => {
    expect(sql).toContain("revoke all on function public.save_production_order_atomic");
    expect(sql).toContain("from anon");
    expect(sql).toContain("from authenticated");
    expect(sql).toContain("to service_role");
  });
});
