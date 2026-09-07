import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// section 2, point 3: the final migration of step 2 -- drops
// purchased_items.base_ingredient_id itself, after every reader/writer
// (0092, 0093, 0094, and this task's TypeScript commit) has already
// deployed. Live-verified 2026-09-02: no FK, check, unique constraint,
// index, or dependent view on this column -- a bare ALTER TABLE DROP
// COLUMN is sufficient, no CASCADE needed (unlike 0090's table drop,
// which did need one).
const MIGRATION_FILE = "0095_drop_base_ingredient_id_column.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

describe("0095: drop purchased_items.base_ingredient_id", () => {
  it("drops the column on purchased_items", () => {
    const migration = readMigration().toLowerCase();
    expect(migration).toContain("alter table public.purchased_items");
    expect(migration).toContain("drop column if exists base_ingredient_id;");
  });

  // Scoped to exactly this one column on exactly this one table -- must
  // never touch base_ingredients (already gone, 0090) or any other column.
  it("touches only purchased_items.base_ingredient_id, in its actual statements", () => {
    const statements = readMigration()
      .replace(/--[^\n]*/g, "")
      .toLowerCase();
    expect(statements).not.toContain("base_ingredients");
    expect(statements).not.toContain("drop table");
    const alterCount = (statements.match(/alter table/g) ?? []).length;
    expect(alterCount).toBe(1);
  });
});
