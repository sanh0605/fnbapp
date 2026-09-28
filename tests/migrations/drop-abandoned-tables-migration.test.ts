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
});
