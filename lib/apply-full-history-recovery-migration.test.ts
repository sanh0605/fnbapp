import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/0031_apply_full_history_recovery.sql");
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").trim().toLowerCase()
  : "";

describe("0031 apply_full_history_recovery", () => {
  it("exists and defines the function", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain("create or replace function public.apply_full_history_recovery(");
  });

  it("rejects any batch or any individual line that is audit-baseline locked", () => {
    expect(migration).toContain(
      "join public.audit_baseline_locks lock on lock.order_line_id = change.value->>'line_id'",
    );
    expect(migration).toContain(
      "select 1 from public.audit_baseline_locks lock where lock.order_line_id = v_line_id",
    );
  });

  it("performs the per-line lock guard before reading or updating the line", () => {
    const guardIndex = migration.indexOf("select 1 from public.audit_baseline_locks lock where lock.order_line_id = v_line_id");
    const selectForUpdateIndex = migration.indexOf("select order_id, cost_at_sale into v_actual_order_id, v_actual_cost");
    const updateIndex = migration.indexOf("update public.order_lines_v2 set cost_at_sale = v_new_cost");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(selectForUpdateIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(selectForUpdateIndex);
    expect(selectForUpdateIndex).toBeLessThan(updateIndex);
  });

  it("supports dry_run and idempotent run-id reuse, matching the established safe RPC pattern", () => {
    expect(migration).toContain("p_dry_run boolean default true");
    expect(migration).toContain("full-history recovery run % exists with a different change count");
    expect(migration).toContain("full-history recovery run % no longer matches current order line values");
  });

  it("restricts execute grant to service_role only", () => {
    const fn = "apply_full_history_recovery(text, text, jsonb, boolean)";
    expect(migration).toContain(`revoke all on function public.${fn} from public;`);
    expect(migration).toContain(`revoke all on function public.${fn} from anon;`);
    expect(migration).toContain(`revoke all on function public.${fn} from authenticated;`);
    expect(migration).toContain(`grant execute on function public.${fn} to service_role;`);
  });
});
