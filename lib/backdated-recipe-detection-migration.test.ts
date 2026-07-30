import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0043_backdated_recipe_detection_on_update.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim().toLowerCase()
  : "";

describe("0043 detect recipe back-dating on update, not only insert", () => {
  it("exists", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("fires on update as well as insert", () => {
    expect(migration).toMatch(/after insert or update on public\.recipes/i);
  });

  it("evaluates the effective start, not the row's creation time", () => {
    expect(migration).toContain("coalesce(new.start_date, new.created_at)");
  });

  it("keeps the recovery escape hatch so replays do not trip it", () => {
    expect(migration).toContain("current_setting('app.mac_drift_recovery', true)");
  });

  it("still restricts the function", () => {
    expect(migration).toContain("revoke all on function");
  });
});
