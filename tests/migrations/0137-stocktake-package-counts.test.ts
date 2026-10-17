import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/0137_stocktake_package_counts.sql", "utf8").replace(/\r\n/g, "\n");
const code = sql.replace(/^--.*$/gm, "");
const body = code.slice(code.indexOf("create function public.save_stocktake_line_atomic")).split("$function$;")[0];

describe("0137 stocktake package counts (BR-INV-023)", () => {
  it("BR-INV-023: adds a nullable jsonb package_counts column, no default", () => {
    expect(code).toMatch(/alter table public\.stocktake_lines add column package_counts jsonb;/i);
  });

  it("BR-INV-023: drops the 2-arg function and creates exactly one 3-arg function", () => {
    expect(code).toMatch(/drop function public\.save_stocktake_line_atomic\(text, numeric\);/i);
    const creates = code.match(/create (or replace )?function public\.save_stocktake_line_atomic\(/gi) ?? [];
    expect(creates).toHaveLength(1);
    expect(code).toMatch(/save_stocktake_line_atomic\(p_line_id text, p_counted_qty numeric, p_package_counts jsonb default null\)/i);
  });

  it("BR-INV-023: a null count clears the line instead of raising", () => {
    expect(body).toMatch(/p_counted_qty is null then/i);
    expect(body).toMatch(/counted_qty = null, theoretical_at_count = null, counted_at = null, package_counts = null/i);
  });

  it("BR-INV-023: a counted line stores the package split", () => {
    expect(body).toMatch(/package_counts = p_package_counts/i);
  });

  it("BR-INV-023: execute is revoked from public/anon/authenticated and granted to service_role", () => {
    expect(code).toMatch(/revoke all on function public\.save_stocktake_line_atomic\(text, numeric, jsonb\)\s+from public, anon, authenticated;/i);
    expect(code).toMatch(/grant execute on function public\.save_stocktake_line_atomic\(text, numeric, jsonb\)\s+to service_role;/i);
  });
});
