import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 2026-10-14 audit F7: pauseProduct/resumeProduct wrote products and
// product_variants in separate calls. 0114 moves both into one function.
// Pins the migration text; the live function cannot be read from here
// (supabase/CLAUDE.md: no session can query pg_catalog).
const MIGRATION_FILE = "0114_set_product_status_atomic.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE), "utf8");
}

function body(): string {
  const match = readMigration().match(
    /create or replace function public\.set_product_status_atomic[\s\S]*?\$\$([\s\S]*?)\$\$/,
  );
  if (!match) throw new Error("set_product_status_atomic not defined in " + MIGRATION_FILE);
  return match[1];
}

describe("0114: set_product_status_atomic", () => {
  it("is security definer with a fixed search_path and only service_role may run it", () => {
    const migration = readMigration();
    expect(migration).toMatch(/security definer\s+set search_path = public/);
    expect(migration).toContain("revoke all on function public.set_product_status_atomic(text, text) from public, anon, authenticated;");
    expect(migration).toContain("grant execute on function public.set_product_status_atomic(text, text) to service_role;");
  });

  it("accepts only ACTIVE or INACTIVE and refuses a missing dish", () => {
    const fn = body();
    expect(fn).toContain("p_status not in ('ACTIVE', 'INACTIVE')");
    expect(fn).toContain("if not found then");
  });

  it("pause: only ACTIVE sizes become INACTIVE, a DELETED size is never touched", () => {
    const fn = body();
    expect(fn).toMatch(/set status = 'INACTIVE'[\s\S]*?status = 'ACTIVE'/);
  });

  it("resume: INACTIVE sizes come back; with no ACTIVE size every non-ACTIVE size comes back", () => {
    const fn = body();
    expect(fn).toContain("v_has_active");
    expect(fn).toMatch(/status = 'INACTIVE'/);
    expect(fn).toMatch(/status <> 'ACTIVE'/);
  });

  it("does not touch order, stock or recipe tables", () => {
    const fn = body();
    expect(fn).not.toMatch(/order_|stock_|recipes/);
  });
});
