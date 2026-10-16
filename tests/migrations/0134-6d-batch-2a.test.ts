import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/0134_6d_batch_2a.sql", "utf8").replace(/\r\n/g, "\n");
const code = sql.replace(/^--.*$/gm, "");
const flat = code.replace(/\s+/g, " ");

const CONSTRAINTS = [
  ["orders_v2", "orders_v2_money_not_negative"],
  ["orders_v2", "orders_v2_net_total_formula"],
  ["orders_v2", "orders_v2_status_links"],
  ["order_lines_v2", "order_lines_v2_money_not_negative"],
  ["order_lines_v2", "order_lines_v2_net_line_total_formula"],
  ["order_lines_v2", "order_lines_v2_order_id_line_no_key"],
] as const;

describe("0134 6d batch 2a", () => {
  it.each(CONSTRAINTS)("%s: drops then adds %s, validated", (table, name) => {
    expect(flat).toContain(`alter table public.${table} drop constraint if exists ${name};`);
    expect(flat).toContain(`alter table public.${table} add constraint ${name}`);
  });

  it("keeps money columns non-negative on orders and lines", () => {
    for (const c of ["gross_total", "promo_discount_total", "manual_item_discount_total", "manual_order_discount", "net_total"]) expect(flat).toContain(`${c} >= 0`);
    for (const c of ["unit_price", "gross_line_total", "promo_discount", "manual_item_discount", "order_discount_allocation", "net_line_total"]) expect(flat).toContain(`${c} >= 0`);
  });

  it("states both net formulas exactly", () => {
    expect(flat).toContain("net_total = gross_total - promo_discount_total - manual_item_discount_total - manual_order_discount");
    expect(flat).toContain("net_line_total = gross_line_total - promo_discount - manual_item_discount - order_discount_allocation");
  });

  it("ties each status to its links both ways", () => {
    expect(flat).toContain("(status = 'COMPLETED' and superseded_by is null and voided_at is null)");
    expect(flat).toContain("(status = 'SUPERSEDED' and superseded_by is not null and voided_at is null)");
    expect(flat).toContain("(status = 'VOIDED' and voided_at is not null and superseded_by is null)");
  });

  it("makes (order_id, line_no) unique and does not re-add qty > 0", () => {
    expect(flat).toContain("unique (order_id, line_no)");
    expect(code).not.toContain("qty");
  });

  it("sets and resets lock_timeout around the constraints", () => {
    const first = sql.indexOf("add constraint");
    expect(sql.indexOf("set lock_timeout = '3s';")).toBeGreaterThan(-1);
    expect(sql.indexOf("set lock_timeout = '3s';")).toBeLessThan(first);
    expect(sql.lastIndexOf("reset lock_timeout;")).toBeGreaterThan(sql.lastIndexOf("add constraint"));
  });

  it("only adds constraints: no function, table or column is redefined or dropped", () => {
    expect(code).not.toMatch(/create or replace function/i);
    expect(code).not.toMatch(/drop (table|column|function)/i);
    const drops = code.match(/\bdrop\b[^;]*/gi) ?? [];
    expect(drops).toHaveLength(6);
    for (const d of drops) expect(d).toMatch(/^drop constraint if exists /i);
  });
});
