import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/0133_6d_batch_1b.sql", "utf8").replace(/\r\n/g, "\n");
const at = (s: string) => sql.indexOf(s);
const body = (name: string) => {
  const start = sql.toLowerCase().indexOf(`create or replace function public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("\nrevoke all", start));
};

const FUNCTIONS = [
  ["create_standalone_topping_product_atomic", "text", /image_url/],
  ["save_product_atomic", "boolean, jsonb, jsonb, jsonb, timestamptz, text[]", /image_url/],
  ["save_purchase_order_atomic", "jsonb, jsonb, boolean, jsonb", /base_unit\s*(,|text)|row\.base_unit|l\.base_unit/],
  ["purchase_order_cancel_check", "text", /l\.base_unit/],
] as const;

const DROPS = [
  ["purchased_items", "default_unit_id"],
  ["suppliers", "parent_id"],
  ["units", "abbreviation"],
  ["product_price_history", "reason"],
  ["asset_depreciation_bands", "status"],
  ["purchase_order_lines", "base_unit"],
  ["products", "image_url"],
];

describe("0133 6d batch 1b", () => {
  it.each(FUNCTIONS)("%s no longer touches its dropped column and keeps its grants", (name, args, dead) => {
    expect(body(name)).not.toMatch(dead);
    expect(sql).toContain(`revoke all on function public.${name}(${args}) from public, anon, authenticated;`);
    expect(sql).toContain(`grant execute on function public.${name}(${args}) to service_role;`);
  });

  it("the cancel check takes the unit from the conversion and keeps the JSON key", () => {
    const b = body("purchase_order_cancel_check");
    expect(b).toMatch(/left join public\.uom_conversions \w+ on \w+\.id = l\.conversion_id/);
    expect(b).toMatch(/left join public\.units u on u\.id = q\.base_unit/);
    expect(b).toContain("coalesce(u.name, '') as unit");
    expect(b).toContain("'base_unit', r.unit");
  });

  it("drops each of the 7 columns in the one form the system map reads", () => {
    for (const [t, c] of DROPS) expect(sql).toContain(`alter table public.${t} drop column ${c};`);
    expect(sql.match(/drop column/g)).toHaveLength(7);
  });

  it("sets lock_timeout before the first drop and the functions come before the drops", () => {
    expect(at("set lock_timeout = '3s';")).toBeGreaterThan(-1);
    expect(at("set lock_timeout")).toBeLessThan(at("drop column"));
    expect(at("create or replace function public.purchase_order_cancel_check")).toBeLessThan(at("drop column"));
  });

  it("header names the triggers and the run order, and adds no key on the asset link", () => {
    expect(sql).toMatch(/touch_updated_at/);
    expect(sql).toMatch(/AFTER the code push/);
    expect(sql).not.toMatch(/purchase_order_line_id\s+(set not null|references)/i);
    expect(sql).not.toMatch(/add constraint[^;]*purchase_order_line_id/i);
  });
});
