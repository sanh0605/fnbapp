import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0017_atomic_void_order.sql"),
  "utf8",
).toLowerCase();

describe("atomic void-order migration", () => {
  it("locks the order and makes reversal, event, and status writes one transaction", () => {
    expect(migration).toContain("create or replace function public.void_order_atomic");
    expect(migration).toContain("from public.orders_v2");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into public.stock_ledger");
    expect(migration).toContain("insert into public.order_events");
    expect(migration).toContain("update public.orders_v2");
  });

  it("guards both existing VOIDED events and existing reversal rows", () => {
    expect(migration).toContain("event_type = 'voided'");
    expect(migration).toContain("transaction_type = 'edit_reversal'");
    expect(migration).toContain("already_voided");
  });

  it("validates that only void events and reversal ledger rows are accepted", () => {
    expect(migration).toContain("<> 'voided'");
    expect(migration).toContain("<> 'edit_reversal'");
    expect(migration).toContain("is distinct from p_order_id");
  });

  it("exposes the RPC only to service_role", () => {
    expect(migration).toContain("from public");
    expect(migration).toContain("from anon");
    expect(migration).toContain("from authenticated");
    expect(migration).toContain("to service_role");
  });
});
