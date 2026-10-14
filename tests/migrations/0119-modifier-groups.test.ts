import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(`supabase/migrations/${f}`, "utf8").replace(/\r\n/g, "\n");
const sql = read("0119_modifier_groups.sql");

// One function's text: from its create line to the next create/revoke/grant line.
const fn = (name: string) => {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  expect(start, `${name} is defined`).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("\nrevoke all on function", start));
};

describe("0119 modifier groups", () => {
  it("creates both tables, the mode checks and the cascading dish links", () => {
    expect(sql).toMatch(/create table if not exists public\.modifier_groups/);
    expect(sql).toMatch(/selection_mode in \('ONE', 'MANY'\)/);
    expect(sql).toMatch(/selection_mode = 'MANY' or \(allow_standalone = false and max_total is null\)/);
    expect(sql).toMatch(/create table if not exists public\.modifier_group_products/);
    // modifiers.group_id refuses to orphan options; the links are settings with no history.
    expect(sql).toMatch(/add column if not exists group_id text references public\.modifier_groups\(id\) on delete restrict/);
    const links = sql.slice(sql.indexOf("create table if not exists public.modifier_group_products"));
    expect(links.slice(0, links.indexOf(");")).match(/on delete cascade/g)).toHaveLength(2);
  });
  it("gives the links a plain id so findAll, the backup and the restore drill can page and re-insert them", () => {
    const links = sql.slice(sql.indexOf("create table if not exists public.modifier_group_products"));
    expect(links.slice(0, links.indexOf(");"))).toMatch(/id text primary key/);
    expect(sql).not.toMatch(/generated always/);
    expect(sql.match(/insert into public\.modifier_group_products \(id, group_id, product_id\)/g)).toHaveLength(3);
  });
  it("seeds Thêm Topping and ticks only drink dishes", () => {
    expect(sql).toMatch(/'Thêm Topping', 'MANY', null, true, 50/);
    expect(sql).toMatch(/t\.is_drink/);
    expect(sql).toMatch(/p\.status <> 'DELETED'/);
    expect(sql).toMatch(/update public\.modifiers[\s\S]*set group_id/);
  });
  it("allows one default per group and clears defaults when a group is Chọn nhiều", () => {
    expect(sql).toMatch(/create unique index if not exists idx_modifiers_one_default[\s\S]*where is_default/);
    expect(fn("save_modifier_group_atomic")).toMatch(/'MANY'[\s\S]{0,200}set is_default = false/);
  });
  it("clears the other default before setting a new one", () => {
    const body = fn("save_modifier_atomic");
    expect(body.indexOf("set is_default = false")).toBeGreaterThan(-1);
    expect(body.indexOf("set is_default = false")).toBeLessThan(body.indexOf("insert into public.modifiers"));
    expect(body).toMatch(/sync_topping_price_atomic\(/);
  });
  it("reads the group, not the name, for standalone toppings", () => {
    const body = fn("create_standalone_topping_product_atomic");
    expect(body).toMatch(/allow_standalone/);
    expect(body).not.toMatch(/'Thêm Topping'/);
  });
  it("replaces save_product_atomic with the 0105 body plus the optional group ticks", () => {
    expect(sql).toMatch(/drop function if exists public\.save_product_atomic\(\s*boolean, jsonb, jsonb, jsonb, timestamptz\s*\)/);
    expect(sql).toMatch(/p_option_group_ids text\[\] default null/);
    const old = read("0105_drop_abandoned_tables.sql");
    const oldBody = old.slice(old.indexOf("declare\n  v_product_id text;"), old.indexOf("  return jsonb_build_object(\n    'product_id', v_product_id,"));
    expect(oldBody.length).toBeGreaterThan(4000);
    expect(fn("save_product_atomic")).toContain(oldBody);
    expect(fn("save_product_atomic")).toMatch(/if p_option_group_ids is not null then[\s\S]*delete from public\.modifier_group_products[\s\S]*insert into public\.modifier_group_products/);
  });
  it("locks every new table and function to service_role", () => {
    for (const t of ["modifier_groups", "modifier_group_products"]) {
      expect(sql).toContain(`alter table public.${t} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${t} from public, anon, authenticated`);
    }
    for (const f of ["save_modifier_group_atomic", "save_modifier_atomic", "save_product_atomic"]) {
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role`));
    }
  });
});
