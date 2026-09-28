import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Owner decision 2026-09-28 ("Ok gỡ"): drop the 10 abandoned tables mapped in
// docs/superpowers/specs/2026-09-28-ban-do-bang-du-lieu.md, with every live
// function that still touched them. Pins the migration text.
const MIGRATION_FILE = "0105_drop_abandoned_tables.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE), "utf8");
}

function saveProductBody(migration: string): string {
  const start = migration.indexOf("create or replace function public.save_product_atomic(");
  const end = migration.indexOf("$$;", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe("0105: drop the abandoned tables", () => {
  it("rewrites save_product_atomic with the same signature and no recipe work", () => {
    const body = saveProductBody(readMigration());
    expect(body).toContain("p_is_edit boolean,");
    expect(body).toContain("p_product jsonb,");
    expect(body).toContain("p_variants jsonb default '[]'::jsonb,");
    expect(body).toContain("p_removed_variant_ids jsonb default '[]'::jsonb,");
    expect(body).toContain("p_effective_at timestamptz default now()");
    expect(body).not.toMatch(/recipe/i);
  });

  it("save_product_atomic still returns the counts the app checks", () => {
    const body = saveProductBody(readMigration());
    expect(body).toContain("'product_id', v_product_id");
    expect(body).toContain("'variant_count', v_variant_count");
    expect(body).toContain("'price_history_count', v_price_history_count");
    expect(body).toContain("'removed_variant_count', v_removed_variant_count");
  });

  // Task 2: the stock-adjustment screen (never able to create an
  // adjustment) is removed with it. Argument lists copied verbatim from
  // each function's last definition: 0083 (submit) and 0084 (approve).
  it("drops the two stock-adjustment functions with their exact argument lists from 0083/0084", () => {
    const migration = readMigration();
    expect(migration).toContain(
      "drop function if exists public.submit_stock_adjustment_atomic(jsonb);",
    );
    expect(migration).toContain(
      "drop function if exists public.approve_stock_adjustment_atomic(text, text, timestamp with time zone);",
    );
  });

  // Task 4: purchased_items.semi_product_id is a live FK into semi_products
  // (0001_init_schema.sql) -- it must go before semi_products can be
  // dropped, and it is dead in application code (never in types/db.ts,
  // 0/151 rows non-null measured 2026-09-28).
  it("drops purchased_items.semi_product_id before dropping semi_products", () => {
    const migration = readMigration();
    const columnDropIndex = migration.indexOf(
      "alter table public.purchased_items drop column if exists semi_product_id;",
    );
    const tableDropIndex = migration.indexOf("drop table if exists public.semi_products");
    expect(columnDropIndex).toBeGreaterThan(-1);
    expect(tableDropIndex).toBeGreaterThan(-1);
    expect(columnDropIndex).toBeLessThan(tableDropIndex);
  });

  // Task 4: the four dead functions named in the plan's "Hàm trong cơ sở dữ
  // liệu còn sống" table -- no code anywhere calls any of them (checked:
  // app/, lib/, scripts/, supabase/functions/). Argument lists copied
  // verbatim from each function's last create-or-replace (0046, 0032, 0045).
  it("drops the three remaining dead functions with their exact argument lists", () => {
    const migration = readMigration();
    expect(migration).toContain(
      "drop function if exists public.apply_full_history_recovery(text, text, jsonb, boolean);",
    );
    expect(migration).toContain(
      "drop function if exists public.remove_audit_baseline_lock(text, text, text);",
    );
    expect(migration).toContain(
      "drop function if exists public.prune_data_recovery_changes();",
    );
  });

  // Task 4: guard against dropping a table that has since gained real data
  // the 2026-09-28 measurement did not account for -- recipes <= 1 (empty
  // ingredients_json), semi_products/production_orders/production_items/
  // stock_adjustments/data_recovery_changes = 0, shifts <= 1, and
  // purchased_items.semi_product_id all null.
  it("guards the table drops against unexpected data with a count check", () => {
    const migration = readMigration();
    const guardStart = migration.indexOf("do $$");
    const guardEnd = migration.indexOf("end $$;", guardStart);
    expect(guardStart).toBeGreaterThan(-1);
    expect(guardEnd).toBeGreaterThan(guardStart);
    const guardBody = migration.slice(guardStart, guardEnd);
    expect(guardBody).toContain("public.recipes");
    expect(guardBody).toContain("ingredients_json");
    expect(guardBody).toContain("public.semi_products");
    expect(guardBody).toContain("public.production_orders");
    expect(guardBody).toContain("public.production_items");
    expect(guardBody).toContain("public.stock_adjustments");
    expect(guardBody).toContain("public.shifts");
    expect(guardBody).toContain("public.data_recovery_changes");
    expect(guardBody).toContain("semi_product_id");
    expect(guardBody).toMatch(/raise exception/);
  });

  // Task 4: the guard must run, and the column drop must run, before any
  // table drop -- a table dropped first would make the guard's own SELECT
  // fail with "relation does not exist" instead of the intended count
  // check.
  it("runs the guard before any table drop", () => {
    const migration = readMigration();
    const guardStart = migration.indexOf("do $$");
    const firstTableDrop = migration.indexOf("drop table if exists public.production_items");
    expect(guardStart).toBeGreaterThan(-1);
    expect(firstTableDrop).toBeGreaterThan(-1);
    expect(guardStart).toBeLessThan(firstTableDrop);
  });

  // Task 4: child-first order, exactly as the plan's FK inventory requires
  // (production_items -> production_orders; shift_stock_checks -> shifts;
  // purchased_items.semi_product_id -> semi_products, dropped above).
  it("drops the 10 abandoned tables in child-first order", () => {
    const migration = readMigration();
    const expectedOrder = [
      "production_items",
      "production_orders",
      "shift_stock_checks",
      "shifts",
      "stock_adjustments",
      "recipes",
      "semi_products",
      "data_recovery_changes",
      "data_migration_runs",
      "sync_state",
    ];
    const indices = expectedOrder.map(table => {
      const index = migration.indexOf(`drop table if exists public.${table}`);
      expect(index).toBeGreaterThan(-1);
      return index;
    });
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  // Fix 1 (critical): prune_data_recovery_changes_trigger (0045:46-49) on
  // public.data_recovery_changes depends on public.prune_data_recovery_
  // changes(). Postgres refuses to drop a function while a trigger still
  // depends on it (the whole migration would roll back). Dropping the
  // TABLE first removes the trigger with it (it is defined ON that table),
  // so the function drop must come after the table drop, not before.
  it("drops prune_data_recovery_changes() after dropping data_recovery_changes, not before", () => {
    const migration = readMigration();
    const functionDropIndex = migration.indexOf(
      "drop function if exists public.prune_data_recovery_changes();",
    );
    const tableDropIndex = migration.indexOf(
      "drop table if exists public.data_recovery_changes",
    );
    expect(functionDropIndex).toBeGreaterThan(-1);
    expect(tableDropIndex).toBeGreaterThan(-1);
    expect(functionDropIndex).toBeGreaterThan(tableDropIndex);
  });

  // Fix 2: 0003_sync_state.sql documents an optional, never-confirmed
  // pg_cron job 'backup-to-sheets-daily' that calls the backup-to-sheets
  // edge function (being deleted). Nobody can tell whether it was ever
  // scheduled on any server, so the unschedule must be guarded: only run
  // if pg_cron is installed, and only touch the job if it exists.
  it("guards the backup-to-sheets-daily cron unschedule behind a pg_cron existence check", () => {
    const migration = readMigration();
    const guardIndex = migration.indexOf(
      "select 1 from pg_extension where extname = 'pg_cron'",
    );
    expect(guardIndex).toBeGreaterThan(-1);
    const unscheduleIndex = migration.indexOf(
      "cron.unschedule(jobid) from cron.job where jobname = 'backup-to-sheets-daily'",
    );
    expect(unscheduleIndex).toBeGreaterThan(guardIndex);
  });
});
