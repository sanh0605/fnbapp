import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(resolve(process.cwd(), "supabase/migrations/0122_stocktake_edit_headroom.sql"), "utf8");
const m = raw.toLowerCase();

describe("0122: editing a confirmed stocktake cannot push stock below zero (Kho đợt 1, K1)", () => {
  it("keeps the signature and the service_role-only grants", () => {
    const sig = "public.edit_confirmed_stocktake_atomic(text, jsonb)";
    expect(m).toContain("create or replace function public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)");
    expect(m).toContain("set search_path to 'public'");
    for (const role of ["public", "anon", "authenticated"]) expect(m).toContain(`revoke all on function ${sig} from ${role}`);
    expect(m).toContain(`grant execute on function ${sig} to service_role`);
  });

  it("checks each edited item's lowest balance from the count's date, after the last write and before returning", () => {
    const check = m.indexOf("public.issue_stock_headroom(v_check, v_confirmed_at)");
    expect(check).toBeGreaterThan(0);
    expect(m.lastIndexOf("insert into public.stock_issues")).toBeLessThan(check);
    expect(check).toBeLessThan(m.indexOf("return jsonb_build_object('session_id'"));
  });

  it("refuses in Vietnamese naming the item, the shortfall and the count's date", () => {
    expect(raw).toContain("sẽ âm kho, thiếu");
    expect(m).toContain("from public.purchased_items pi where pi.id = v_check");
    expect(m).toContain("'dd/mm/yyyy'");
  });

  it("keeps the stock lock, adds no table, and says it is not yet run", () => {
    expect(m).toContain("pg_advisory_xact_lock(hashtext('stock_issues:id'))");
    expect(m).not.toContain("create table");
    expect(m).toContain("not yet run");
  });
});
