import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("supabase/migrations/0125_drop_deleted_status.sql");

function sql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8").toLowerCase();
}

// 13 master tables allowed DELETED. product_variants keeps it: save_product_atomic (0119) still
// marks a removed size DELETED, so dropping it there would break removing a size from a dish.
const DROPPED = [
  "brands", "item_categories", "modifiers", "product_categories", "products", "promotions",
  "purchase_sources", "purchased_items", "suppliers", "units", "uom_conversions", "users",
];

describe("0125 drop DELETED status migration", () => {
  it("says it is not run", () => {
    expect(sql()).toContain("not yet run");
  });

  it.each(DROPPED)("%s: status allows only ACTIVE and INACTIVE", (table) => {
    const s = sql();
    expect(s).toContain(`alter table public.${table} drop constraint ${table}_status_check`);
    expect(s).toContain(`add constraint ${table}_status_check check (status in ('active', 'inactive'))`);
  });

  it("leaves product_variants alone and says why", () => {
    const s = sql();
    expect(s).not.toContain("alter table public.product_variants");
    expect(s).toContain("save_product_atomic");
  });
});
