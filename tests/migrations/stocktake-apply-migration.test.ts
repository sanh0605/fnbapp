import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("supabase/migrations/0037_apply_stocktake_session.sql");

describe("0037 apply stocktake session migration", () => {
  it("applies the server-saved count-time variance without reversing later ledger movements", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    expect(sql).toContain("function public.apply_stocktake_session_atomic");
    expect(sql).toContain("v_count_variance := v_line.counted_qty - v_line.theoretical_at_count");
    expect(sql).toContain("coalesce(sum(quantity_change), 0)");
    expect(sql).toContain("v_projected_qty := v_current_theoretical_qty + v_count_variance");
    expect(sql).toContain("v_plan_hash := md5(v_plan_hash_rows::text)");
    expect(sql).toContain("p_expected_plan_hash");
    expect(sql).toContain("quantity_change,\n        unit_cost, created_at, notes");
    expect(sql).toContain("v_count_variance,");
  });

  it("supports a no-write dry run and locks an open session before a single apply", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    expect(sql).toContain("for update");
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('stock_ledger:id'))");
    expect(sql).toContain("if p_dry_run then");
    expect(sql).toContain("update public.stocktake_sessions set");
    expect(sql).toContain("status = 'confirmed'");
    expect(sql).toContain("to service_role");
  });
});
