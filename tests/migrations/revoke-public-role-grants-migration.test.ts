import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Audit E9: anon/authenticated must hold no table or function rights.
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0117_revoke_public_role_grants.sql"),
  "utf8",
);
// Strip comments so header prose cannot satisfy or break an assertion.
const sql = migration.replace(/--.*$/gm, "");

const TABLES = [
  "asset_depreciation_bands",
  "asset_disposals",
  "assets",
  "order_payments",
  "outlets",
  "purchase_order_edits",
];

describe("revoke public API role grants (0117)", () => {
  it.each(TABLES)("revokes all on %s from anon and authenticated", (table) => {
    expect(sql).toContain(
      `revoke all on table public.${table} from anon, authenticated;`,
    );
  });

  it("revokes execute on rls_auto_enable and touch_updated_at from public, anon, authenticated", () => {
    for (const fn of ["rls_auto_enable", "touch_updated_at"]) {
      expect(sql).toMatch(new RegExp(`proname\\s*=\\s*'${fn}'|'${fn}'`));
    }
    expect(sql).toMatch(
      /revoke execute on function .* from public, anon, authenticated/,
    );
  });

  it("revokes default privileges for postgres on tables, functions and sequences", () => {
    for (const kind of ["tables", "functions", "sequences"]) {
      expect(sql).toContain(
        `alter default privileges for role postgres in schema public revoke all on ${kind} from anon, authenticated;`,
      );
    }
    // A schema-scoped revoke from public is a no-op (the PUBLIC execute default is
    // global); new functions keep their own explicit revoke, as since 0091.
    expect(sql).not.toMatch(/in schema public revoke execute on functions from public/);
  });

  it("does not try to alter supabase_admin defaults", () => {
    expect(sql).not.toMatch(/for role supabase_admin/);
  });

  it("never revokes from service_role", () => {
    expect(sql).not.toMatch(/revoke[^;]*service_role/i);
  });
});
