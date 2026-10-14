import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 2026-10-14 audit A4: the depreciation bands are saved as a whole table in
// one transaction (migration 0118). Pins the migration text; the live
// function cannot be read from here (supabase/CLAUDE.md).
const MIGRATION_FILE = "0118_replace_asset_depreciation_bands.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE), "utf8");
}

function body(): string {
  const match = readMigration().match(
    /create or replace function public\.replace_asset_depreciation_bands[\s\S]*?\$\$([\s\S]*?)\$\$/,
  );
  if (!match) throw new Error("replace_asset_depreciation_bands not defined in " + MIGRATION_FILE);
  return match[1];
}

describe("0118: replace_asset_depreciation_bands", () => {
  it("is security definer with a fixed search_path and only service_role may run it", () => {
    const migration = readMigration();
    expect(migration).toMatch(/security definer\s+set search_path = public/);
    expect(migration).toContain("revoke all on function public.replace_asset_depreciation_bands(jsonb) from public, anon, authenticated;");
    expect(migration).toContain("grant execute on function public.replace_asset_depreciation_bands(jsonb) to service_role;");
  });

  it("locks the table before reading or writing", () => {
    const fn = body();
    expect(fn).toContain("lock table public.asset_depreciation_bands in share row exclusive mode");
  });

  it("refuses a first band that does not start at 0 and mins that do not strictly increase", () => {
    const fn = body();
    expect(fn).toContain("Khung đầu tiên phải bắt đầu từ 0đ");
    expect(fn).toContain("phải lớn hơn");
  });

  it("derives max_unit_price from the next band's min, null on the last", () => {
    expect(body()).toMatch(/lead\([\s\S]*?\) over \(order by/);
  });

  it("updates rows with ids, deletes the rest, inserts new rows with KH-NNN ids under an advisory lock", () => {
    const fn = body();
    expect(fn).toMatch(/update public\.asset_depreciation_bands/);
    expect(fn).toMatch(/delete from public\.asset_depreciation_bands/);
    expect(fn).toContain("pg_advisory_xact_lock(hashtext('asset_depreciation_bands:id'))");
    expect(fn).toContain("'KH-' || lpad(");
  });

  it("refuses an unknown id and an empty list", () => {
    const fn = body();
    expect(fn).toContain("Không tìm thấy khung khấu hao");
    expect(fn).toContain("Phải có ít nhất một khung khấu hao");
  });
});
