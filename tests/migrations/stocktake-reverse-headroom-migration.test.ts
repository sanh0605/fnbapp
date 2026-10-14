// tests/migrations/stocktake-reverse-headroom-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0111_stocktake_reverse_headroom.sql"),
  "utf8",
);
const m = raw.toLowerCase();

function body(): string {
  const start = m.indexOf("create or replace function public.reverse_stocktake_session_atomic(");
  if (start < 0) throw new Error("reverse_stocktake_session_atomic not found");
  const open = m.indexOf("$function$", start);
  return m.slice(open, m.indexOf("$function$", open + 1));
}

describe("0111: undoing a stocktake cannot push stock below zero (audit A1)", () => {
  it("keeps the signature and the service_role-only grants", () => {
    const sig = "public.reverse_stocktake_session_atomic(text, text, text, text)";
    expect(m).toContain("create or replace function public.reverse_stocktake_session_atomic(p_session_id text, p_reason text, p_reversed_by_id text, p_reversed_by_name text)");
    expect(m).toContain(`revoke all on function ${sig} from public`);
    expect(m).toContain(`revoke all on function ${sig} from anon`);
    expect(m).toContain(`revoke all on function ${sig} from authenticated`);
    expect(m).toContain(`grant execute on function ${sig} to service_role`);
    expect(m).toContain("set search_path to 'public'");
  });

  it("checks the lowest balance of every item that loses stock, after the reverse rows are written", () => {
    const b = body();
    expect(b).toContain("public.issue_stock_headroom(");
    // Only a row that removes stock (found-at-count undone) needs the check.
    expect(b).toMatch(/base_quantity < 0/);
    expect(b.indexOf("insert into public.stock_issues")).toBeLessThan(b.indexOf("public.issue_stock_headroom("));
    // The check comes before the session is marked REVERSED.
    expect(b.indexOf("public.issue_stock_headroom(")).toBeLessThan(b.indexOf("update public.stocktake_sessions"));
  });

  it("refuses in Vietnamese, naming the item", () => {
    const b = body();
    expect(raw).toContain("sẽ âm kho");
    expect(b).toMatch(/from public\.purchased_items/);
  });

  it("holds the same stock lock as the other stock writers and adds no table", () => {
    expect(body()).toContain("pg_advisory_xact_lock(hashtext('stock_issues:id'))");
    expect(m).not.toContain("create table");
  });

  it("the header names the triggers and the deploy order", () => {
    const header = raw.slice(0, raw.indexOf("\ncreate or replace function")).toLowerCase();
    expect(header).toContain("trigger");
    expect(header).toContain("deploy order");
  });
});
