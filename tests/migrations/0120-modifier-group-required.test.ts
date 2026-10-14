import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/0120_modifier_group_required.sql", "utf8").replace(/\r\n/g, "\n");
const at = (s: string) => sql.indexOf(s);

describe("0120 modifier group required", () => {
  it("refuses, naming the ids, when an option still has no group", () => {
    expect(sql).toMatch(/where m\.group_id is null and g\.name = m\.group_name/);
    expect(sql).toMatch(/string_agg\(id[\s\S]*?where group_id is null;[\s\S]*?raise exception 'Options without a group_id[^']*: %', v_ids/);
  });
  it("sets not null only after the check, and drops the column last", () => {
    expect(sql).toMatch(/alter column group_id set not null/);
    expect(at("raise exception")).toBeLessThan(at("alter column group_id set not null"));
    expect(at("alter column group_id set not null")).toBeLessThan(at("drop column group_name"));
    expect(sql).toMatch(/alter table public\.modifiers drop column group_name/);
  });
  it("replaces the 4-argument sync with a 3-argument one that has the same return and grants", () => {
    expect(sql).toMatch(/drop function public\.sync_topping_price_atomic\(text, bigint, text, text\)/);
    const start = at("create function public.sync_topping_price_atomic(");
    expect(start).toBeGreaterThan(-1);
    const body = sql.slice(start, sql.indexOf("\nrevoke all", start));
    expect(body).toMatch(/p_modifier_id text,\s*p_price bigint,\s*p_name text\s*\)\s*returns jsonb/);
    expect(body).not.toMatch(/group_name/);
    expect(sql).toMatch(/revoke all on function public\.sync_topping_price_atomic\(text, bigint, text\) from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.sync_topping_price_atomic\(text, bigint, text\) to service_role;/);
  });
  it("save_modifier_atomic no longer names group_name, keeps its signature and grants", () => {
    const start = at("create or replace function public.save_modifier_atomic(");
    expect(start).toBeGreaterThan(-1);
    const body = sql.slice(start, sql.indexOf("\nrevoke all", start));
    expect(body).not.toMatch(/group_name/);
    expect(body).toMatch(/p_is_edit boolean,\s*p_modifier jsonb\s*\)\s*returns jsonb/);
    expect(body).toMatch(/sync_topping_price_atomic\(\s*v_id, \(p_modifier->>'price'\)::bigint, p_modifier->>'name'\s*\)/);
    expect(sql).toMatch(/grant execute on function public\.save_modifier_atomic\(boolean, jsonb\) to service_role;/);
  });
});
