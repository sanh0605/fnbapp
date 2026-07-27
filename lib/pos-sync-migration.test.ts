// lib/pos-sync-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration 0040: POS sync tracking", () => {
  const sql = readFileSync(
    resolve(__dirname, "../supabase/migrations/0040_pos_sync_tracking.sql"),
    "utf8",
  ).toLowerCase();

  it("adds synced_at to orders_v2", () => {
    expect(sql).toContain("alter table public.orders_v2 add column if not exists synced_at timestamptz");
  });

  it("creates pos_sync_failures locked down to service_role", () => {
    expect(sql).toContain("create table if not exists public.pos_sync_failures");
    expect(sql).toContain("revoke all on table public.pos_sync_failures from public, anon, authenticated");
    expect(sql).toContain("grant select, insert, update on table public.pos_sync_failures to service_role");
  });

  it("sets synced_at to now() at actual insert time in create_pos_order_atomic_unvalidated_0024", () => {
    // Migration 0035 renamed the function that actually inserts into
    // orders_v2 to create_pos_order_atomic_unvalidated_0024, putting a
    // payment-validating wrapper named create_pos_order_atomic in front of
    // it. synced_at must be added to the renamed inner function, not the
    // wrapper -- the wrapper only validates and delegates, it never touches
    // orders_v2 directly.
    expect(sql).toContain("create or replace function public.create_pos_order_atomic_unvalidated_0024");
    expect(sql).not.toContain("create function public.create_pos_order_atomic(");
    expect(sql).not.toContain("drop function if exists public.create_pos_order_atomic(");
    expect(sql).toContain("synced_at");
    expect(sql).toMatch(/insert into public\.orders_v2 \([\s\S]*synced_at[\s\S]*\)/);
  });
});
