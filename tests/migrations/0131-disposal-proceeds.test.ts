import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// BR-COGS-008 / plan 2026-10-16-thanh-ly-thu-tien: pins the migration text; the live
// function cannot be read from here (supabase/CLAUDE.md).
const raw = readFileSync(resolve(process.cwd(), "supabase/migrations/0131_disposal_proceeds.sql"), "utf8").replace(/\r\n/g, "\n");
const sql = raw.replace(/--[^\n]*/g, "").toLowerCase();
const fn = raw.match(/create or replace function public\.dispose_asset_atomic[\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1] ?? "";

describe("0131: disposal proceeds", () => {
  it("lists the triggers it touches in the header", () => {
    for (const t of ["trg_cash_entries_touch", "trg_cash_categories_touch", "asset_disposals_guard"]) {
      expect(raw.split("\n").slice(0, 40).join("\n")).toContain(t);
    }
  });

  it("links a cash entry to its disposal: unique, restrict", () => {
    expect(sql).toMatch(/alter table public\.cash_entries\s+add column if not exists asset_disposal_id text\s+unique\s+references public\.asset_disposals\(id\) on delete restrict/);
  });

  it("adds the category flag with both checks and one-flagged-category index", () => {
    expect(sql).toContain("add column if not exists is_asset_disposal boolean not null default false");
    expect(sql).toContain("check (not is_asset_disposal or (kind = 'income' and affects_pnl))");
    expect(sql).toContain("check (not (is_sales_revenue and is_asset_disposal))");
    expect(sql).toMatch(/create unique index if not exists \w+\s+on public\.cash_categories \(is_asset_disposal\)\s+where is_asset_disposal/);
  });

  it("adds the Thu thanh lý tài sản group as CFC-008, income, counted in P&L, flagged", () => {
    expect(sql).toMatch(/select 'cfc-008', 'thu thanh lý tài sản', 'income', true, true/);
    expect(sql).toMatch(/where not exists \(\s*select 1 from public\.cash_categories\s+where status = 'active' and lower\(btrim\(name\)\)/);
    expect(sql).toContain("on conflict (id) do nothing");
  });

  it("dispose_asset_atomic is security definer, fixed search_path, service_role only", () => {
    expect(sql).toMatch(/security definer\s+set search_path to 'public'/);
    expect(sql).toMatch(/revoke all on function public\.dispose_asset_atomic\([^)]*\) from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.dispose_asset_atomic\([^)]*\) to service_role;/);
  });

  it("writes the disposal, then the proceeds row only when the amount is above 0", () => {
    expect(fn).toMatch(/insert into public\.asset_disposals/);
    expect(fn).toMatch(/if p_amount > 0 then[\s\S]*insert into public\.cash_entries[\s\S]*asset_disposal_id/);
  });

  it("refuses in Vietnamese: missing flagged group, stopped group, stopped bank account", () => {
    expect(fn).toContain("Chưa có nhóm thu thanh lý tài sản");
    expect(fn).toContain("Nhóm thu thanh lý tài sản đã ngừng dùng");
    expect(fn).toContain("Tài khoản không còn dùng");
  });
});
