import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/0020_atomic_supersede_order.sql"),
  "utf8",
).toLowerCase();

describe("0020 atomic supersede order migration", () => {
  it("locks and checks the old order version before all five writes", () => {
    expect(sql).toContain("function public.supersede_order_v2_atomic");
    expect(sql).toContain("for update");
    expect(sql).toContain("optimistic lock failed");
    expect(sql).toContain("update public.orders_v2");
    expect(sql).toContain("insert into public.orders_v2");
    expect(sql).toContain("insert into public.order_lines_v2");
    expect(sql).toContain("insert into public.order_events");
    expect(sql).toContain("insert into public.stock_ledger");
  });

  it("validates edit relationships and row counts", () => {
    expect(sql).toContain("edit_reversal");
    expect(sql).toContain("sales_consume");
    expect(sql).toContain("line count mismatch");
    expect(sql).toContain("ledger count mismatch");
    expect(sql).toContain("p_event.order_id must match the new order");
  });

  it("limits execution to the service role", () => {
    expect(sql).toContain("from anon");
    expect(sql).toContain("from authenticated");
    expect(sql).toContain("to service_role");
  });
});
