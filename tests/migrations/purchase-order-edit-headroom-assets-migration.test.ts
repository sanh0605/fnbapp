// tests/migrations/purchase-order-edit-headroom-assets-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0112_purchase_order_edit_headroom_assets.sql"),
  "utf8",
);
const m = raw.toLowerCase();

const open = m.indexOf("$function$", m.indexOf("create or replace function public.save_purchase_order_atomic("));
const save = m.slice(open, m.indexOf("$function$", open + 1));

describe("0112: editing a completed purchase order (audit A3a) and its assets (audit A7)", () => {
  it("replaces the 3-argument function, so no overload is left behind", () => {
    expect(m).toContain("drop function if exists public.save_purchase_order_atomic(jsonb, jsonb, boolean)");
    expect(m).toContain(
      "create or replace function public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb default '[]'::jsonb, p_replace_existing boolean default false, p_assets jsonb default null)",
    );
    const sig = "public.save_purchase_order_atomic(jsonb, jsonb, boolean, jsonb)";
    expect(m).toContain(`revoke all on function ${sig} from public, anon, authenticated`);
    expect(m).toContain(`grant execute on function ${sig} to service_role`);
    expect(m).toContain("set search_path to 'public'");
  });

  it("A3a: the replace path takes the stock lock before the row lock, as cancel does", () => {
    const lock = save.indexOf("pg_advisory_xact_lock(hashtext('stock_issues:id'))");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(save.indexOf("for update"));
    expect(lock).toBeGreaterThan(save.indexOf("if p_replace_existing then"));
  });

  it("A3a: a completed order's balance is measured before the writes and again after them", () => {
    const before = save.indexOf("issue_stock_headroom(");
    const after = save.lastIndexOf("issue_stock_headroom(");
    expect(before).toBeGreaterThan(-1);
    expect(after).toBeGreaterThan(before);
    expect(before).toBeLessThan(save.indexOf("update public.purchase_orders"));
    expect(after).toBeGreaterThan(save.indexOf("insert into public.purchase_order_lines"));
    // From the earlier of the old and the new date, over the old and the new items.
    expect(save).toContain("least(");
    expect(save).toContain("v_existing_status = 'completed'");
    // Refuses only an edit that makes it worse, so a harmless edit of an already-negative item passes.
    expect(save).toMatch(/v_after < 0 and v_after < v_before/);
    expect(raw).toContain("sẽ âm kho");
  });

  it("BR-INV-018 (A3b): a stock- or cost-moving edit of an order covered by a confirmed stocktake is refused, like the cancel", () => {
    const lock = save.indexOf("public.issue_slip_stocktake_lock(");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(save.indexOf("update public.purchase_orders"));
    // Both the stored date and the new date are tested against the stocktake.
    expect(save).toContain("issue_slip_stocktake_lock(v_old_at)");
    expect(save).toContain("issue_slip_stocktake_lock(v_new_at)");
    // What counts as moving stock or cost: the date, the amounts, the lines.
    for (const col of ["subtotal_amount", "shipping_fee", "tax_amount", "voucher_amount", "discount_amount", "total_amount"]) {
      expect(save).toMatch(new RegExp(`${col} is distinct from`));
    }
    // The form sends the date without milliseconds; compare to the second.
    expect(save).toContain("date_trunc('second', v_new_at) is distinct from date_trunc('second', v_old_at)");
    // Duplicate lines count (except all, both ways) and a stored null or '' equals what the form sends back.
    expect(save.match(/except all/g)?.length).toBe(2);
    expect(save).not.toMatch(/nullif\(x\.unit/);
    expect(save).toContain("coalesce(l.unit, '')");
    expect(save).toContain("coalesce(x.unit, '')");
    // Notes, invoice code and payment details are not part of the comparison.
    const guard = save.slice(lock - 1500, save.indexOf("update public.purchase_orders"));
    for (const col of ["notes", "supplier_invoice_code", "payment_method", "bank_account_id"]) {
      expect(guard).not.toContain(col);
    }
    expect(raw).toContain("nằm trước lần kiểm kê");
    expect(raw).toContain("BR-INV-018");
  });

  it("A7: asset rows are written by the function, after the lines, with the same columns as the old TypeScript insert", () => {
    expect(save).toContain("p_assets");
    expect(save.indexOf("insert into public.assets")).toBeGreaterThan(save.indexOf("insert into public.purchase_order_lines"));
    expect(save).toMatch(
      /insert into public\.assets \(\s*id, purchased_item_id, purchase_order_line_id, name_snapshot, acquired_date,\s*unit_cost, total_cost, quantity, term_months\s*\)/,
    );
    // Ids keep the TS-NNN shape of generateNewId (padded to 3, never cut: lpad would cut TS-1000).
    expect(save).toContain("'^ts-([0-9]+)$'");
    expect(save).not.toContain("lpad(v_next_asset_number");
    expect(save).toContain("pg_advisory_xact_lock(hashtext('assets:id'))");
    // Retire = status INACTIVE; patch columns are the ones planAssetReconcile can change.
    expect(save).toMatch(/update public\.assets\s+set status = 'inactive'/);
    for (const col of ["quantity", "unit_cost", "total_cost", "term_months", "acquired_date"]) {
      expect(save).toMatch(new RegExp(`${col} = coalesce\\(\\(v_asset\\.patch->>'${col}'\\)`));
    }
    expect(save).not.toContain("delete from public.assets");
  });

  it("returns the same two keys as before", () => {
    expect(save).toContain("'purchase_order_id', v_po_id");
    expect(save).toContain("'line_count', v_line_count");
  });

  it("the header names the triggers, the old caller and the deploy order, and adds no table", () => {
    const header = raw.slice(0, raw.indexOf("\ndrop function")).toLowerCase();
    expect(header).toContain("trg_assets_touch");
    expect(header).toContain("trg_purchase_orders_touch");
    expect(header).toContain("deploy order");
    expect(m).not.toContain("create table");
  });
});
