import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// One-time exception to BR-INV-009 (owner, 2026-09-28): every issue slip
// from 2026-09-27 on (ISL-00075..ISL-00088) is erased with all its
// stock_issues rows and the rows that reverse them. Pins the migration
// text: the deletes are guarded by exact counts, and run children first
// (reversals -> originals -> slip headers) so no foreign key refuses.
const MIGRATION_FILE = "0104_erase_issue_slips_since_0927.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE), "utf8");
}

describe("0104: erase issue slips ISL-00075..ISL-00088", () => {
  it("targets exactly the slip range the owner approved", () => {
    const migration = readMigration();
    expect(migration).toContain("id between 'ISL-00075' and 'ISL-00088'");
  });

  it("refuses unless the measured counts still hold (14 slips, 32 lines, 25 reversals)", () => {
    const migration = readMigration();
    expect(migration).toContain("if v_slips <> 14 then");
    expect(migration).toContain("if v_lines <> 32 then");
    expect(migration).toContain("if v_reversals <> 25 then");
  });

  it("refuses if a row outside the set reverses a row inside it", () => {
    expect(readMigration()).toContain("'A stock_issues row outside the erased set reverses one inside it'");
  });

  it("deletes reversals, then slip lines, then slip headers", () => {
    const migration = readMigration();
    const guardAt = migration.indexOf("if v_slips <> 14 then");
    const reversalsAt = migration.indexOf("delete from public.stock_issues where reverses_issue_id in");
    const linesAt = migration.indexOf("delete from public.stock_issues where issue_slip_id in");
    const slipsAt = migration.indexOf("delete from public.issue_slips where id between 'ISL-00075' and 'ISL-00088';");
    expect(guardAt).toBeGreaterThan(-1);
    expect(reversalsAt).toBeGreaterThan(guardAt);
    expect(linesAt).toBeGreaterThan(reversalsAt);
    expect(slipsAt).toBeGreaterThan(linesAt);
  });
});
