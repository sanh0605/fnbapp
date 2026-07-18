import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0022_gate3_database_hardening.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  : "";

const hardenedTables = [
  "base_ingredients",
  "brands",
  "item_categories",
  "modifiers",
  "order_events",
  "order_lines_v2",
  "orders_v2",
  "pos_drafts",
  "product_categories",
  "product_price_history",
  "product_variants",
  "production_items",
  "production_orders",
  "products",
  "promotions",
  "purchase_order_lines",
  "purchase_orders",
  "purchase_sources",
  "purchased_items",
  "recipes",
  "semi_products",
  "stock_adjustments",
  "stock_ledger",
  "suppliers",
  "sync_state",
  "units",
  "uom_conversions",
  "users",
] as const;

describe("Gate 3 Phase B database hardening migration", () => {
  it("explicitly revokes every table privilege from anon and authenticated", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(hardenedTables).toHaveLength(28);

    for (const table of hardenedTables) {
      expect(migration).toContain(
        `revoke select, insert, update, delete, truncate, references, trigger, maintain on table public.${table} from anon, authenticated;`,
      );
    }

    for (const alreadyHardened of [
      "audit_baseline_locks",
      "backdated_ledger_events",
      "data_migration_runs",
      "data_recovery_changes",
    ]) {
      expect(migration).not.toContain(`on table public.${alreadyHardened}`);
    }
  });

  it("drops only the orphaned order counter function", () => {
    expect(migration).toContain(
      "drop function if exists public.next_order_num(uuid);",
    );
    expect(migration).not.toContain("create table order_counters");
    expect(migration).not.toContain("create table public.order_counters");
  });

  it("tracks the live RLS event trigger definition", () => {
    expect(migration).toContain(
      "create or replace function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path to 'pg_catalog'",
    );
    expect(migration).toContain(
      "where command_tag in ('create table', 'create table as', 'select into') and object_type in ('table','partitioned table')",
    );
    expect(migration).toContain(
      "execute format('alter table if exists %s enable row level security', cmd.object_identity);",
    );
    expect(migration).toContain("drop event trigger if exists ensure_rls;");
    expect(migration).toContain(
      "create event trigger ensure_rls on ddl_command_end when tag in ('create table', 'create table as', 'select into') execute function public.rls_auto_enable();",
    );
  });

  it("removes the two stale diagnostics", () => {
    expect(existsSync(resolve(process.cwd(), "scripts/check-constraint-query.ts")))
      .toBe(false);
    expect(existsSync(resolve(process.cwd(), "scripts/check-promotions-constraint.ts")))
      .toBe(false);
  });
});
