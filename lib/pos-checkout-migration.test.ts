import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0008_pos_checkout_performance.sql"),
  "utf8",
).toLowerCase();

describe("POS checkout performance migration", () => {
  it("returns compact inventory balances and MAC costs", () => {
    expect(migration).toContain(
      "create or replace function public.get_pos_inventory_state",
    );
    expect(migration).toContain("'balances'");
    expect(migration).toContain("'mac_unit_costs'");
    expect(migration).toContain("from public.stock_ledger");
  });

  it("allocates the bill number and writes the bill under one transaction lock", () => {
    expect(migration).toContain(
      "create or replace function public.create_pos_order_atomic",
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("insert into public.orders_v2");
    expect(migration).toContain("insert into public.order_lines_v2");
    expect(migration).toContain("insert into public.order_events");
    expect(migration).toContain("insert into public.stock_ledger");
  });

  it("validates all payloads before allocating a bill number", () => {
    const validation = migration.indexOf(
      "if p_order is null or jsonb_typeof(p_order) <> 'object'",
    );
    const allocation = migration.indexOf("pg_advisory_xact_lock");

    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(allocation);
    expect(migration).toContain(
      "if p_lines is null or jsonb_typeof(p_lines) <> 'array'",
    );
    expect(migration).toContain(
      "if p_event is null or jsonb_typeof(p_event) <> 'object'",
    );
    expect(migration).toContain(
      "if p_ledger is null or jsonb_typeof(p_ledger) <> 'array'",
    );
  });

  it("exposes both functions only to the service role", () => {
    expect(migration).toContain(
      "revoke all on function public.get_pos_inventory_state",
    );
    expect(migration).toContain(
      "revoke all on function public.create_pos_order_atomic",
    );
    expect(migration).toContain("to service_role");
  });
});
