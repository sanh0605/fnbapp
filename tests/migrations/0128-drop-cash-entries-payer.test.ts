import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0128_drop_cash_entries_payer.sql"),
  "utf8",
).replace(/--[^\n]*/g, "").toLowerCase();

describe("0128: drop cash_entries.payer", () => {
  it("drops only that column, with no cascade or table drop", () => {
    expect(sql).toContain("alter table public.cash_entries drop column if exists payer;");
    expect(sql).not.toContain("cascade");
    expect(sql).not.toContain("drop table");
    expect((sql.match(/alter table/g) ?? []).length).toBe(1);
  });
});
