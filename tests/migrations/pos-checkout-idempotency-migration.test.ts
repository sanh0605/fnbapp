import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0023_pos_checkout_idempotency.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .toLowerCase()
  : "";

describe("POS checkout idempotency migration", () => {
  it("adds a nullable unique request key without rewriting historical orders", () => {
    expect(migration).toContain(
      "alter table public.orders_v2 add column if not exists client_request_id text",
    );
    expect(migration).toContain(
      "create unique index if not exists idx_orders_v2_client_request_id",
    );
    expect(migration).toContain("where client_request_id is not null");
    expect(migration).not.toContain("update public.orders_v2 set client_request_id");
  });

  it("keeps the request key optional for older callers", () => {
    expect(migration).toContain("p_client_request_id text default null");
    expect(migration).toContain(
      "drop function if exists public.create_pos_order_atomic(text, jsonb, jsonb, jsonb, jsonb)",
    );
  });

  it("serializes duplicate attempts and returns the existing persisted counts", () => {
    const lock = migration.indexOf(
      "pg_advisory_xact_lock(hashtext('pos:client_request:' || v_client_request_id))",
    );
    const existingLookup = migration.indexOf(
      "where client_request_id = v_client_request_id",
    );
    const orderNumberLock = migration.indexOf(
      "pg_advisory_xact_lock(hashtext('pos:order_no:' || v_brand_code))",
    );

    expect(lock).toBeGreaterThan(-1);
    expect(existingLookup).toBeGreaterThan(lock);
    expect(orderNumberLock).toBeGreaterThan(existingLookup);
    expect(migration).toContain("'idempotent_replay', true");
    expect(migration).toContain("transaction_type = 'sales_consume'");
  });

  it("stores the request key and keeps the RPC service-role only", () => {
    expect(migration).toContain("client_request_id");
    expect(migration).toContain("v_client_request_id");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
