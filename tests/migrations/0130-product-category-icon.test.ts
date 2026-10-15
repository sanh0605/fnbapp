import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0130_product_category_icon.sql"),
  "utf8",
).replace(/--[^\n]*/g, "").toLowerCase();

describe("0130: product_categories.icon", () => {
  it("adds one nullable text column and nothing else structural", () => {
    expect(sql).toContain("alter table public.product_categories add column icon text;");
    expect(sql).not.toContain("not null");
    expect(sql).not.toContain("drop ");
  });

  it("backfills only the three real keyword matches, never over an owner's choice", () => {
    const updates = sql.match(/update public\.product_categories[^;]*;/g) ?? [];
    expect(updates).toHaveLength(3);
    for (const [id, icon] of [["cat-001", "☕"], ["cat-004", "🍵"], ["cat-005", "🥛"]]) {
      expect(updates.some(u => u.includes(`'${icon}'`) && u.includes(`id = '${id}'`) && u.includes("icon is null"))).toBe(true);
    }
  });
});
