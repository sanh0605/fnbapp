import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/0121_order_dead_columns_and_links.sql", "utf8").replace(/\r\n/g, "\n");
const at = (s: string) => sql.indexOf(s);
const body = (name: string) => {
  const start = at(`create or replace function public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("\nrevoke all", start));
};
const DEAD = /cost_at_sale|recipe_snapshot_json|manual_discount_reason|payment_ref|currency/;

describe("0121 order dead columns and links", () => {
  it("header states the run order", () => {
    expect(sql).toMatch(/OUTSIDE OPENING HOURS/);
    expect(sql).toMatch(/Push the A4b code/);
    expect(sql).toMatch(/Data write 1.*independent/);
  });

  it.each([
    ["create_pos_order_atomic_unvalidated_0025", "text, jsonb, jsonb, jsonb, text, jsonb"],
    ["supersede_order_v2_atomic", "text, integer, jsonb, jsonb, jsonb"],
    ["void_order_atomic", "text, jsonb, timestamptz, text, text"],
  ])("%s ignores every dropped key and keeps its grants", (name, args) => {
    expect(body(name)).not.toMatch(DEAD);
    expect(sql).toContain(`revoke all on function public.${name}(${args}) from public, anon, authenticated;`);
    expect(sql).toContain(`grant execute on function public.${name}(${args}) to service_role;`);
  });

  it("supersede keeps SECURITY DEFINER and its search_path", () => {
    expect(body("supersede_order_v2_atomic")).toMatch(/security definer\s+set search_path to 'public'/i);
  });

  it("the till function reads links as null and the payment reference as empty", () => {
    const pos = body("create_pos_order_atomic_unvalidated_0025");
    for (const key of ["parent_order_id", "superseded_by", "voided_by_id", "applied_promotion_id"]) {
      expect(pos).toContain(`nullif(p_order->>'${key}', '')`);
    }
    expect(pos).toContain("nullif(p_event->>'previous_order_id', '')");
    expect(pos).toContain("'reference', ''");
  });

  it("void and supersede store no link as null", () => {
    const vd = body("void_order_atomic");
    expect(vd).toContain("nullif(p_event->>'previous_order_id', '')");
    expect(vd).toContain("voided_by_id = nullif(p_voided_by_id, '')");
    const sup = body("supersede_order_v2_atomic");
    for (const key of ["superseded_by", "voided_by_id", "applied_promotion_id"]) {
      expect(sup).toContain(`nullif(p_new_order->>'${key}', '')`);
    }
  });

  it("minting does not cut: it parses 3 or more digits and pads only below 1000", () => {
    const pos = body("create_pos_order_atomic_unvalidated_0025");
    expect(pos).toContain("~ '^[0-9]{3,}$'");
    expect(pos).toMatch(/case when v_next_number < 1000 then lpad\(v_next_number::text, 3, '0'\) else v_next_number::text end/);
  });

  it("turns empty text into null before the foreign keys, and drops columns after the functions", () => {
    expect(at("set parent_order_id = nullif(parent_order_id, '')")).toBeGreaterThan(-1);
    expect(at("update public.order_events set previous_order_id = null where previous_order_id = ''")).toBeGreaterThan(-1);
    expect(at("create or replace function public.void_order_atomic")).toBeLessThan(at("drop column cost_at_sale"));
    expect(at("set parent_order_id = nullif")).toBeLessThan(at("add constraint orders_v2_parent_order_id_fkey"));
  });

  it("drops exactly the dead columns and keeps order_payments.reference", () => {
    for (const drop of [
      "drop column cost_at_sale", "drop column recipe_snapshot_json", "drop column manual_discount_reason",
      "drop column currency", "drop column payment_ref",
      "drop column description", "drop column brand_id",
    ]) {
      expect(sql).toContain(drop);
    }
    expect(sql).toMatch(/alter table public\.product_variants drop column sort_order;/);
    expect(sql).toMatch(/alter table public\.modifiers drop column sort_order;/);
    expect(sql).not.toMatch(/order_payments\s+drop column/);
    expect(sql).not.toMatch(/modifier_groups\s+drop column/);
  });

  it("status check loses DRAFT", () => {
    expect(sql).toContain("check (status in ('COMPLETED', 'SUPERSEDED', 'VOIDED'))");
  });

  it("adds the link foreign keys; superseded_by is deferred; voided_by_id gets none", () => {
    expect(sql).toMatch(/orders_v2_superseded_by_fkey\s+foreign key \(superseded_by\) references public\.orders_v2 \(id\) on delete restrict\s+deferrable initially deferred/);
    expect(sql).toMatch(/foreign key \(applied_promotion_id\) references public\.promotions \(id\) on delete restrict/);
    expect(sql).toMatch(/order_events_previous_order_id_fkey\s+foreign key \(previous_order_id\) references public\.orders_v2 \(id\) on delete restrict/);
    expect(sql).not.toMatch(/foreign key \(voided_by_id\)/);
  });

  it("order lines and order events restrict instead of cascading", () => {
    expect(sql).toMatch(/order_lines_v2_order_id_fkey\s+foreign key \(order_id\) references public\.orders_v2 \(id\) on delete restrict/);
    expect(sql).toMatch(/order_events_order_id_fkey\s+foreign key \(order_id\) references public\.orders_v2 \(id\) on delete restrict/);
    expect(sql).not.toMatch(/on delete cascade/);
  });

  it("does not touch product_price_history", () => {
    expect(sql).not.toMatch(/alter table public.product_price_history/);
    expect(sql).not.toMatch(/new_price <= 0/);
  });
});
