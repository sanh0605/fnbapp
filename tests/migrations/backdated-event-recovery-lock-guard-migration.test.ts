import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0030_harden_backdated_event_recovery_against_locks.sql",
);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim().toLowerCase()
  : "";

describe("0030 harden backdated event recovery against audit_baseline_locks", () => {
  it("exists", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("redefines both apply_backdated_event_recovery and apply_backdated_recipe_event_recovery", () => {
    expect(migration).toContain("create or replace function public.apply_backdated_event_recovery(");
    expect(migration).toContain("create or replace function public.apply_backdated_recipe_event_recovery(");
  });

  it("rejects any change whose line_id has an existing audit_baseline_locks row, in both functions", () => {
    const guardOccurrences = migration.split(
      "join public.audit_baseline_locks lock on lock.order_line_id = change.value->>'line_id'",
    ).length - 1;
    expect(guardOccurrences).toBe(2);
  });

  it("performs the lock guard check before setting app.mac_drift_recovery=on, in both functions", () => {
    // The guard must run before the bypass flag is set, otherwise a locked
    // line could still slip through if the guard were placed after.
    const bypassSet = "perform set_config('app.mac_drift_recovery', 'on', true);";
    const guardCheck = "join public.audit_baseline_locks lock";

    const firstFunctionEnd = migration.indexOf(
      "create or replace function public.apply_backdated_recipe_event_recovery(",
    );
    const firstFunctionBody = migration.slice(0, firstFunctionEnd);
    const secondFunctionBody = migration.slice(firstFunctionEnd);

    for (const body of [firstFunctionBody, secondFunctionBody]) {
      const guardIndex = body.indexOf(guardCheck);
      const bypassIndex = body.indexOf(bypassSet);
      expect(guardIndex).toBeGreaterThan(-1);
      expect(bypassIndex).toBeGreaterThan(-1);
      expect(guardIndex).toBeLessThan(bypassIndex);
    }
  });

  it("keeps every other clause from the prior definitions unchanged (spot check key invariants)", () => {
    // Idempotency / reuse guards from 0026 and 0029 must still be present.
    expect(migration).toContain("backdated event recovery run % exists with a different change count");
    expect(migration).toContain("backdated recipe event recovery run % exists with a different change count");
    expect(migration).toContain("order line % changed after planning");
    // search_path fix from 0026/0029 must be preserved.
    expect(migration).toContain("set search_path = public, extensions");
  });

  it("still restricts execute grants to service_role only", () => {
    for (const fn of [
      "apply_backdated_event_recovery(uuid, text, jsonb)",
      "apply_backdated_recipe_event_recovery(uuid, text, jsonb)",
    ]) {
      expect(migration).toContain(`revoke all on function public.${fn} from public;`);
      expect(migration).toContain(`revoke all on function public.${fn} from anon;`);
      expect(migration).toContain(`revoke all on function public.${fn} from authenticated;`);
      expect(migration).toContain(`grant execute on function public.${fn} to service_role;`);
    }
  });
});
