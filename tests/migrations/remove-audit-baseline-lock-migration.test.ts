import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/0032_allow_audit_baseline_lock_removal.sql");
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim().toLowerCase()
  : "";

describe("0032 remove_audit_baseline_lock", () => {
  it("exists and defines the function", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain("create or replace function public.remove_audit_baseline_lock(");
  });

  it("requires a reviewer and a reason, not just the line id", () => {
    expect(migration).toContain("p_reviewer is required");
    expect(migration).toContain("p_reason is required");
  });

  it("logs the removal to data_recovery_changes before deleting the lock row", () => {
    const logIndex = migration.indexOf("insert into public.data_recovery_changes");
    const deleteIndex = migration.indexOf("delete from public.audit_baseline_locks");
    expect(logIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(logIndex).toBeLessThan(deleteIndex);
  });

  it("restricts execute grant to service_role only", () => {
    const fn = "remove_audit_baseline_lock(text, text, text)";
    expect(migration).toContain(`revoke all on function public.${fn} from public;`);
    expect(migration).toContain(`revoke all on function public.${fn} from anon;`);
    expect(migration).toContain(`revoke all on function public.${fn} from authenticated;`);
    expect(migration).toContain(`grant execute on function public.${fn} to service_role;`);
  });

  it("uses extensions in search_path (digest() lives there, matching the 0026 fix)", () => {
    expect(migration).toContain("set search_path = public, extensions");
  });
});
