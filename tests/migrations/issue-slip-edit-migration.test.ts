import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_FILE = "0106_issue_slip_edit.sql";
const sql = () => readFileSync(resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE), "utf8");
function body(name: string): string {
  const m = sql().match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$([\\s\\S]*?)\\$function\\$`));
  if (!m) throw new Error(`${name} not defined in ${MIGRATION_FILE}`);
  return m[1];
}

describe("0106: issue-slip edit", () => {
  it("edit dates new lines on the slip and checks stock from then to now", () => {
    const b = body("edit_issue_slip_atomic");
    expect(b).toContain("issue_stock_headroom(");
    expect(b).toContain("v_slip.issued_at");
    expect(b).toContain("issue_slip_id");
    expect(b).toMatch(/reverse_manual_issue_atomic\(/);
    expect(b).toContain("array_position("); // cumulative per item, as in 0094
  });

  it("edit, reverse, cancel and create all refuse a slip before the last confirmed stocktake", () => {
    for (const fn of ["edit_issue_slip_atomic", "reverse_manual_issue_atomic", "cancel_issue_slip_atomic", "create_issue_slip_atomic"]) {
      expect(body(fn)).toContain("issue_slip_stocktake_lock(");
    }
    expect(body("issue_slip_stocktake_lock")).toContain("'CONFIRMED'");
  });

  it("edit refuses a line that is not an active line of this slip", () => {
    expect(body("edit_issue_slip_atomic")).toContain("không thuộc phiếu");
  });

  it("edit rejects a removal list that names the same line twice", () => {
    const b = body("edit_issue_slip_atomic");
    expect(b).toContain("trùng");
    expect(b).toMatch(/count\(distinct/i);
  });

  it("fix round 1: cancelled slip, null ids, purchase date fallback, shortage wording", () => {
    const e = body("edit_issue_slip_atomic");
    expect(e).toContain("đã huỷ, không sửa được");
    expect(e.indexOf("đã huỷ, không sửa được")).toBeLessThan(e.indexOf("reverse_manual_issue_atomic("));
    expect(e).toContain("Danh sách dòng bỏ có mã trống.");
    expect(e.indexOf("mã trống")).toBeLessThan(e.indexOf("mã trùng"));
    for (const fn of ["edit_issue_slip_atomic", "create_issue_slip_atomic"]) {
      const b = body(fn);
      expect(b).toContain("coalesce(po.transaction_date, po.created_at) <= ");
      expect(b).not.toMatch(/and po\.transaction_date <=/);
      expect(b).toContain("Không đủ tồn kho cho %: từ ngày phiếu tới nay có lúc kho chỉ còn % %.");
    }
  });

  it("create checks the lowest balance from its date onward, not only at its date", () => {
    expect(body("create_issue_slip_atomic")).toContain("issue_stock_headroom(");
  });

  it("headroom walks every later positive issue", () => {
    const b = body("issue_stock_headroom");
    expect(b).toContain("si.issued_at > p_at");
    expect(b).toContain("base_quantity > 0");
  });

  it("grants execute to service_role only", () => {
    for (const fn of ["edit_issue_slip_atomic", "issue_stock_headroom", "issue_slip_stocktake_lock",
      "reverse_manual_issue_atomic", "cancel_issue_slip_atomic", "create_issue_slip_atomic"]) {
      expect(sql()).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\)\\s+to service_role`));
    }
  });

  it("every function body has balanced if/end if and loop/end loop", () => {
    const bodies = [...sql().matchAll(/create or replace function[\s\S]*?\$function\$([\s\S]*?)\$function\$/g)].map((m) => m[1]);
    expect(bodies.length).toBeGreaterThanOrEqual(6);
    for (const raw of bodies) {
      const code = raw
        .split("\n")
        .map((line) => line.replace(/'(?:[^']|'')*'/g, "''").replace(/--.*$/, ""))
        .join("\n");
      const closeIf = (code.match(/\bend\s+if\b/gi) ?? []).length;
      const openIf = (code.match(/\bif\b/gi) ?? []).length - closeIf;
      const closeLoop = (code.match(/\bend\s+loop\b/gi) ?? []).length;
      const openLoop = (code.match(/\bloop\b/gi) ?? []).length - closeLoop;
      expect(openIf).toBe(closeIf);
      expect(openLoop).toBe(closeLoop);
    }
  });

  it("uses $function$ delimiters only", () => {
    expect(sql()).not.toMatch(/\$\$/);
  });

  it("header lists triggers from the migration text, not a server check", () => {
    const head = sql().split("\n").slice(0, 40).join("\n");
    expect(head).toMatch(/trigger/i);
    expect(head).not.toMatch(/kiểm trực tiếp trên máy chủ|verified on the server/i);
  });
});
