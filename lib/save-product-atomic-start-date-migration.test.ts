import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0044_save_product_atomic_start_date.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim().toLowerCase()
  : "";

describe("0044 save_product_atomic writes start_date, not only created_at", () => {
  it("exists", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("redefines save_product_atomic", () => {
    expect(migration).toContain("create or replace function public.save_product_atomic(");
  });

  it("the recipes insert now names start_date alongside end_date", () => {
    const insertStart = migration.indexOf("insert into public.recipes (");
    expect(insertStart).toBeGreaterThan(-1);
    const insertClause = migration.slice(insertStart, insertStart + 400);
    expect(insertClause).toContain("start_date");
    expect(insertClause).toContain("end_date");
  });

  it("start_date is set to the same effective timestamp as created_at, not now()", () => {
    // Both columns must share p_effective_at (falling back to now()) so a
    // recipe entered with a past effective date resolves consistently
    // through selectEffectiveRecipe (start_date, falling back to created_at).
    const insertStart = migration.indexOf("insert into public.recipes (");
    const valuesStart = migration.indexOf("values (", insertStart);
    const valuesClause = migration.slice(valuesStart, valuesStart + 400);
    const occurrences = valuesClause.split("coalesce(p_effective_at, now())").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("keeps every other clause from 0021 unchanged (spot check key invariants)", () => {
    expect(migration).toContain("active recipe % changed before versioning");
    expect(migration).toContain("variant % already has an active recipe");
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('recipes:id'))");
  });

  it("still restricts execute grants to service_role only", () => {
    const fn = "save_product_atomic( boolean, jsonb, jsonb, jsonb, timestamptz )";
    expect(migration).toContain(`revoke all on function public.${fn} from public;`);
    expect(migration).toContain(`revoke all on function public.${fn} from anon;`);
    expect(migration).toContain(`revoke all on function public.${fn} from authenticated;`);
    expect(migration).toContain(`grant execute on function public.${fn} to service_role;`);
  });
});
