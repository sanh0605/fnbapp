import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/0127_order_promotions.sql", "utf8").replace(/\r\n/g, "\n");
const live = readFileSync("supabase/migrations/0121_order_dead_columns_and_links.sql", "utf8").replace(/\r\n/g, "\n");
const fn = (text: string) => {
  const start = text.indexOf("create or replace function public.create_pos_order_atomic_unvalidated_0025(");
  return text.slice(start, text.indexOf("\n$function$;", start));
};

describe("0127 order_promotions", () => {
  it("creates the table with RESTRICT keys, one row per promotion per order, RLS on and public roles revoked", () => {
    expect(sql).toMatch(/references public\.orders_v2\(id\) on delete restrict/);
    expect(sql).toMatch(/references public\.promotions\(id\) on delete restrict/);
    expect(sql).toMatch(/unique \(order_id, promotion_id\)/);
    expect(sql).toContain("alter table public.order_promotions enable row level security;");
    expect(sql).toContain("revoke all on table public.order_promotions from anon, authenticated;");
  });

  it("adds promotions.stackable defaulting to false", () => {
    expect(sql).toContain("add column if not exists stackable boolean not null default false");
  });

  it("backfills from applied_promotion_id and can be rerun", () => {
    expect(sql).toMatch(/join public\.promotions pr on pr\.id = o\.applied_promotion_id/);
    expect(sql).toMatch(/where not exists \(\s*select 1 from public\.order_promotions op/);
  });

  it("the order function is 0121's body plus only the order_promotions insert", () => {
    const strip = (s: string) => s.replace(/\n  -- Promotions applied[\s\S]*?  end if;\n/, "");
    expect(strip(fn(sql))).toBe(fn(live));
    expect(fn(sql)).toContain("p_order->'promotions'");
    expect(fn(sql)).toContain("applied_promotion_id");
    expect(sql).toContain("grant execute on function public.create_pos_order_atomic_unvalidated_0025(text, jsonb, jsonb, jsonb, text, jsonb) to service_role;");
  });

  it("the edit function is 0121's body plus only the copy of the old order's promotions", () => {
    const edit = (text: string) => {
      const start = text.indexOf("create or replace function public.supersede_order_v2_atomic(");
      return text.slice(start, text.indexOf("\n$function$;", start));
    };
    const strip = (s: string) => s.replace(/\n  -- Edited order keeps[\s\S]*?where order_id = p_old_order_id;\n/, "");
    expect(strip(edit(sql))).toBe(edit(live));
    expect(edit(sql)).toContain("from public.order_promotions");
    expect(sql).toContain("grant execute on function public.supersede_order_v2_atomic(text, integer, jsonb, jsonb, jsonb) to service_role;");
  });
});
