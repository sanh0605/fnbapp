import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("supabase/migrations/0110_edit_confirmed_stocktake.sql");

function sql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8").toLowerCase();
}

describe("0110 edit confirmed stocktake migration (BR-INV-012)", () => {
  it("defines the security-definer function with a pinned search_path", () => {
    const s = sql();
    expect(s).toContain("function public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)");
    expect(s).toContain("security definer");
    expect(s).toContain("set search_path to 'public'");
  });

  it("locks the session row and refuses anything but CONFIRMED", () => {
    const s = sql();
    expect(s).toContain("from public.stocktake_sessions where id = v_session_id for update");
    expect(s).toContain("if v_status <> 'confirmed' then");
    expect(s).toContain("không ở trạng thái đã xác nhận");
  });

  it("refuses while any session is OPEN", () => {
    const s = sql();
    expect(s).toContain("exists (select 1 from public.stocktake_sessions where status = 'open')");
    expect(s).toContain("đang có một phiếu kiểm kê mở");
  });

  it("refuses unless the session is the latest CONFIRMED by confirmed_at", () => {
    const s = sql();
    expect(s).toContain("where status = 'confirmed' order by confirmed_at desc limit 1");
    expect(s).toContain("chỉ sửa được phiếu kiểm kê mới nhất");
  });

  it("numbers new ISS- rows under the stock_issues advisory lock", () => {
    const s = sql();
    const lock = s.indexOf("pg_advisory_xact_lock(hashtext('stock_issues:id'))");
    expect(lock).toBeGreaterThan(-1);
    expect(s.indexOf("max(substring(id from '^iss-([0-9]+)$')")).toBeGreaterThan(lock);
  });

  it("dates a new issue row at the confirmation instant, source STOCKTAKE, never now()", () => {
    const s = sql();
    expect(s).toContain("v_issue_id, v_line.item_reference, v_confirmed_at, -v_variance, 'stocktake', v_session_id");
    expect(s).not.toContain("now()");
  });

  it("updates an existing issue row in place and deletes it when the variance is 0", () => {
    const s = sql();
    expect(s).toContain("update public.stock_issues set base_quantity = -v_variance");
    expect(s).toContain("delete from public.stock_issues where id = v_existing_issue_id");
    expect(s).toContain("if v_variance = 0 then");
  });

  it("looks the session's issue row up by (session, item) before inserting", () => {
    const s = sql();
    expect(s).toContain("where session_id = v_session_id and purchased_item_id = v_line.item_reference and reverses_issue_id is null");
    expect(s).toContain("cho cùng một hàng");
  });

  it("skips a line whose count did not change", () => {
    expect(sql()).toContain("counted_qty is not distinct from v_new_qty then continue");
  });

  it("is callable by service_role only", () => {
    const s = sql();
    for (const role of ["public", "anon", "authenticated"]) {
      expect(s).toContain(`revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from ${role};`);
    }
    expect(s).toContain("grant execute on function public.edit_confirmed_stocktake_atomic(text, jsonb) to service_role;");
  });

  it("rejects bad input in Vietnamese", () => {
    const s = sql();
    for (const text of ["không có dòng nào để sửa", "phải là một số", "không được âm", "không thuộc phiếu", "không phải hàng mua"]) {
      expect(s).toContain(text);
    }
  });
});
