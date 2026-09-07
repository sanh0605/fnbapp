import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// section 2.4/2.1: drop the base_ingredients table, not just its rows.
// CASCADE is required and is the one easy way to get this migration wrong
// silently -- live measurement 2026-09-01 found
// purchased_items_base_ingredient_id_fkey (ON DELETE RESTRICT), which the
// plan's own section 1.3 said did not exist. A bare DROP TABLE fails
// outright ("other objects depend on it") rather than orphaning anything,
// but it does fail -- CASCADE is what actually lets this migration run.
const MIGRATION_FILE = "0090_delete_tier2_ingredient_groups.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

describe("0090: drop base_ingredients with cascade", () => {
  it("drops the table with cascade, not a bare drop", () => {
    const migration = readMigration().toLowerCase();
    expect(migration).toContain("drop table public.base_ingredients cascade;");
  });

  // Step 2 (dropping the base_ingredient_id column on purchased_items) is
  // explicitly out of scope -- this migration's own SQL statements (not its
  // explanatory comments, which legitimately name purchased_items to
  // explain why CASCADE is required) must never touch that table.
  it("touches only base_ingredients, no other table, in its actual statements", () => {
    const statements = readMigration()
      .replace(/--[^\n]*/g, "")
      .toLowerCase();
    expect(statements).not.toContain("purchased_items");
    expect(statements).not.toContain("alter table");
  });
});
