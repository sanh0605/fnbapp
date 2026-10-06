// tests/migrations/purchase-order-cancel-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0108_purchase_order_cancel.sql"),
  "utf8",
);
const m = raw.toLowerCase();

// Body of one function, from its "create or replace function" to the closing delimiter.
function fnBody(name: string): string {
  const start = m.indexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  const open = m.indexOf("$function$", start);
  const close = m.indexOf("$function$", open + 1);
  return m.slice(open, close);
}

describe("0108: cancel a purchase order", () => {
  it("adds the four cancel columns and ties CANCELLED to a reason", () => {
    for (const col of ["cancelled_at timestamptz", "cancelled_by_id text", "cancelled_by_name text", "cancel_reason text"]) {
      expect(m).toContain(`add column ${col}`);
    }
    expect(m).toContain("constraint purchase_orders_cancelled_has_reason check");
    expect(m).toMatch(/\(status = 'cancelled'\) = \(cancelled_at is not null and nullif\(btrim\(coalesce\(cancel_reason, ''\)\), ''\) is not null\)/);
  });

  it("save refuses a stored CANCELLED order and any status but DRAFT/COMPLETED", () => {
    expect(raw).toContain("Phiếu đã huỷ, không sửa được");
    expect(m).toMatch(/not in \('draft', 'completed'\)/);
    const save = fnBody("save_purchase_order_atomic");
    // The stored status is read under the row lock, before the update.
    expect(save).toMatch(/select id, status\s+into v_existing_id, v_existing_status\s+from public\.purchase_orders\s+where id = v_po_id\s+for update/);
    expect(save.indexOf("v_existing_status = 'cancelled'")).toBeLessThan(save.indexOf("update public.purchase_orders"));
  });

  it("check: stocktake lock as a moment, lowest balance since the order, disposals, non-inactive assets", () => {
    const check = fnBody("purchase_order_cancel_check");
    expect(check).toContain("public.issue_slip_stocktake_lock(v_at)");
    expect(check).toContain("coalesce(v_po.transaction_date, v_po.created_at)");
    expect(check).toContain("si.issued_at > v_at and si.base_quantity > 0");
    expect(check).toContain("order by item, balance asc, at asc");
    expect(check).toContain("from public.asset_disposals");
    expect(check).toContain("r.status <> 'inactive'");
    expect(check).not.toMatch(/::date/);
    expect(m).toMatch(/purchase_order_cancel_check\(p_id text\)\s+returns jsonb language plpgsql stable/);
  });

  it("cancel: same stock lock as the slip writers, row lock, reason limits, one transaction, no delete", () => {
    const cancel = fnBody("cancel_purchase_order_atomic");
    expect(cancel).toContain("pg_advisory_xact_lock(hashtext('stock_issues:id'))");
    expect(cancel).toMatch(/from public\.purchase_orders\s+where id = p_id\s+for update/);
    expect(cancel).toContain("lý do huỷ phiếu là bắt buộc");
    expect(cancel).toContain("lý do huỷ tối đa 500 ký tự");
    expect(cancel).toContain("char_length(v_reason) > 500");
    expect(cancel).toMatch(/update public\.assets\s+set status = 'inactive'/);
    expect(cancel).not.toContain("delete from");
    // The copied save function keeps its own delete-and-reinsert of lines; nothing else deletes.
    expect(fnBody("purchase_order_cancel_check")).not.toContain("delete from");
  });

  it("both new functions and the save are service_role only", () => {
    for (const sig of [
      "public.purchase_order_cancel_check(text)",
      "public.cancel_purchase_order_atomic(text, text, text, text)",
      "public.save_purchase_order_atomic(jsonb, jsonb, boolean)",
    ]) {
      expect(m).toContain(`revoke all on function ${sig} from public, anon, authenticated`);
      expect(m).toContain(`grant execute on function ${sig} to service_role`);
    }
  });

  it("the header names the rule, triggers, writers and deploy order", () => {
    const header = raw.slice(0, raw.indexOf("alter table"));
    expect(header).toContain("BR-INV-015");
    expect(header).toContain("trg_purchase_orders_touch");
    expect(header).toContain("trg_assets_touch");
    expect(header).toContain("setPurchaseOrderPayment");
    expect(header.toLowerCase()).toContain("deploy order");
  });

  it("adds no table", () => {
    expect(m).not.toContain("create table");
  });
});
