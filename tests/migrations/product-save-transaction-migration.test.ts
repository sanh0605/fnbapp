import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/0021_atomic_product_save.sql"),
  "utf8",
).toLowerCase();

describe("0021 atomic product save migration", () => {
  it("writes the complete catalog plan under ID and variant locks", () => {
    expect(sql).toContain("function public.save_product_atomic");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("insert into public.products");
    expect(sql).toContain("update public.products");
    expect(sql).toContain("insert into public.product_variants");
    expect(sql).toContain("update public.product_variants");
    expect(sql).toContain("insert into public.product_price_history");
    expect(sql).toContain("insert into public.recipes");
  });

  it("keeps price history and recipe versioning in the same transaction", () => {
    expect(sql).toContain("for update");
    expect(sql).toContain("create_version");
    expect(sql).toContain("create_initial");
    expect(sql).toContain("unchanged");
    expect(sql).toContain("price_history_count");
    expect(sql).toContain("recipe_count");
    expect(sql).toContain("removed_variant_count");
  });

  it("limits execution to the service role", () => {
    expect(sql).toContain("from anon");
    expect(sql).toContain("from authenticated");
    expect(sql).toContain("to service_role");
  });
});
