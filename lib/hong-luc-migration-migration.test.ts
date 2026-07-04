import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/0009_hong_to_luc_migration.sql",
  ),
  "utf8",
).toLowerCase();

describe("Hồng trà to Lục trà atomic migration", () => {
  it("captures a focused before-image and applies all writes atomically", () => {
    expect(migration).toContain(
      "create table if not exists public.data_migration_runs",
    );
    expect(migration).toContain("before_image jsonb not null");
    expect(migration).toContain("write_set jsonb not null");
    expect(migration).toContain(
      "create or replace function public.apply_hong_to_luc_migration",
    );
    expect(migration).toContain("update public.order_lines_v2");
    expect(migration).toContain("delete from public.stock_ledger");
    expect(migration).toContain("insert into public.stock_ledger");
    expect(migration).toContain("insert into public.order_events");
    expect(migration).toContain("delete from public.recipes");
  });

  it("refuses source fingerprint changes under row locks", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("source fingerprint mismatch");
    expect(migration).toContain("ledger fingerprint mismatch");
    expect(migration).toContain("recipe fingerprint mismatch");
    expect(migration).toContain("affected order is superseded");
    expect(migration).toContain("expected order count mismatch");
    expect(migration).toContain("expected order numbers mismatch");
  });

  it("detects partial state and returns success for a complete idempotent rerun", () => {
    expect(migration).toContain("partial migration state");
    expect(migration).toContain("'already_applied', true");
    expect(migration).toContain("migration_key");
    expect(migration).toContain("source_hash");
  });

  it("only grants execution to the service role", () => {
    expect(migration).toContain("from public");
    expect(migration).toContain("from anon");
    expect(migration).toContain("from authenticated");
    expect(migration).toContain("to service_role");
  });
});
