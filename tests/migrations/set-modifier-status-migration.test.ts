import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 2026-10-15 "Ngừng cả hai": stopping an option also stops its linked dish, in one function.
// Pins the migration text; the live function cannot be read from here.
const MIGRATION_FILE = "0126_set_modifier_status_atomic.sql";
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE), "utf8");
const fn = migration.match(/create or replace function public\.set_modifier_status_atomic[\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1] ?? "";

describe("0126: set_modifier_status_atomic", () => {
  it("is security definer with a fixed search_path and only service_role may run it", () => {
    expect(migration).toMatch(/security definer\s+set search_path = public/);
    expect(migration).toContain("revoke all on function public.set_modifier_status_atomic(text, text) from public, anon, authenticated;");
    expect(migration).toContain("grant execute on function public.set_modifier_status_atomic(text, text) to service_role;");
  });

  it("accepts only ACTIVE or INACTIVE and refuses an unknown option, in Vietnamese", () => {
    expect(fn).toContain("p_status not in ('ACTIVE', 'INACTIVE')");
    expect(fn).toContain("Trạng thái không hợp lệ");
    expect(fn).toContain("if not found then");
    expect(fn).toContain("Không tìm thấy tuỳ chọn");
  });

  it("locks the sibling options of the same dish before reading them, in id order", () => {
    expect(fn).toMatch(/perform 1 from public\.modifiers where id = p_modifier_id or product_id = v_product_id order by id for update/);
  });

  it("refuses ACTIVE while another ACTIVE option has the same dish, naming it", () => {
    expect(fn).toMatch(/product_id = v_product_id and id <> p_modifier_id and status = 'ACTIVE'/);
    expect(fn).toMatch(/p_status = 'ACTIVE' and v_other_active/);
    expect(fn).toContain('Đã có tuỳ chọn "%" đang dùng cho món bán riêng này; ngừng tuỳ chọn đó trước.');
  });

  it("only INACTIVE stops an ACTIVE linked dish, and only when no other ACTIVE option runs it", () => {
    expect(fn).toMatch(/p_status = 'INACTIVE' and v_product_id is not null and not v_other_active/);
    expect(fn).toContain("status = 'ACTIVE'");
    expect(fn).toContain("perform public.set_product_status_atomic(v_product_id, 'INACTIVE')");
    expect(fn).not.toContain("set_product_status_atomic(v_product_id, 'ACTIVE')");
  });

  it("returns modifier_id and product_stopped", () => {
    expect(fn).toContain("'modifier_id'");
    expect(fn).toContain("'product_stopped'");
  });
});
