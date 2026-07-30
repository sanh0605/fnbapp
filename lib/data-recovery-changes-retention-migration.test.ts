import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0045_data_recovery_changes_retention.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim().toLowerCase()
  : "";

describe("0045 data_recovery_changes 30-day retention", () => {
  it("exists", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("indexes applied_at so the prune delete is cheap", () => {
    expect(migration).toContain("create index if not exists data_recovery_changes_applied_at_idx");
  });

  it("prunes rows older than 30 days", () => {
    expect(migration).toContain("create or replace function public.prune_data_recovery_changes()");
    expect(migration).toContain("where applied_at < now() - interval '30 days'");
  });

  it("fires once per statement, not once per row, so a batch insert prunes once", () => {
    expect(migration).toMatch(/after insert on public\.data_recovery_changes\s*for each statement/);
  });

  it("still restricts the function", () => {
    expect(migration).toContain("revoke all on function public.prune_data_recovery_changes() from public;");
    expect(migration).toContain("revoke all on function public.prune_data_recovery_changes() from anon;");
    expect(migration).toContain("revoke all on function public.prune_data_recovery_changes() from authenticated;");
  });
});
