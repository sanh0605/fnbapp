// tests/migrations/purchase-order-new-completed-stocktake-lock-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0116_purchase_order_new_completed_stocktake_lock.sql"),
  "utf8",
);
const m = raw.toLowerCase();

const open = m.indexOf("$function$", m.indexOf("create or replace function public.save_purchase_order_atomic("));
const save = m.slice(open, m.indexOf("$function$", open + 1));

describe("0116 (BR-INV-018, new orders too): a completed order dated on or before the last confirmed stocktake is refused", () => {
  it("keeps the 4-argument signature, sets search_path and locks the function to service_role", () => {
    expect(m).toContain(
      "create or replace function public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb default '[]'::jsonb, p_replace_existing boolean default false, p_assets jsonb default null)",
    );
    const sig = "public.save_purchase_order_atomic(jsonb, jsonb, boolean, jsonb)";
    expect(m).toContain(`revoke all on function ${sig} from public, anon, authenticated`);
    expect(m).toContain(`grant execute on function ${sig} to service_role`);
    expect(m).toContain("set search_path to 'public'");
    expect(m).not.toContain("drop function");
  });

  it("applies when the order is saved as COMPLETED and was not stored as COMPLETED (new, or a draft being completed)", () => {
    expect(save).toContain("coalesce(nullif(p_order->>'status', ''), 'draft') = 'completed'");
    expect(save).toContain("v_prev_status is distinct from 'completed'");
    // A new order has no stored row to read.
    expect(save).toMatch(/if p_replace_existing then\s+select po\.status, po\.created_at into v_prev_status, v_prev_created_at/);
  });

  it("tests the order's own date (transaction_date, else created_at, else now) against the last confirmed stocktake", () => {
    expect(save).toContain("issue_slip_stocktake_lock(v_new_at)");
    expect(save).toMatch(/v_new_at := coalesce\(\s*nullif\(p_order->>'transaction_date', ''\)::timestamptz,\s*v_prev_created_at,/);
    expect(save).toContain("nullif(p_order->>'created_at', '')::timestamptz");
    expect(save).toContain("now()");
  });

  it("refuses before anything is written and takes the stock lock first, like a slip", () => {
    const lock = save.indexOf("issue_slip_stocktake_lock(v_new_at)");
    expect(lock).toBeGreaterThan(save.indexOf("pg_advisory_xact_lock(hashtext('stock_issues:id'))"));
    expect(lock).toBeLessThan(save.indexOf("update public.purchase_orders"));
    expect(lock).toBeLessThan(save.indexOf("insert into public.purchase_orders ("));
    expect(lock).toBeLessThan(save.indexOf("insert into public.purchase_order_lines"));
  });

  it("raises a Vietnamese refusal that names the stocktake, in the shape of the 0112 edit refusal, and offers the draft", () => {
    expect(raw).toContain("nằm trước lần kiểm kê");
    expect(raw).toContain("BR-INV-018");
    expect(save).toContain("lưu nháp");
    expect(save).toContain("to_char((select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock)");
  });

  it("leaves 0112's edit path of a completed order, the balance checks and the assets as they were", () => {
    expect(save).toContain("issue_slip_stocktake_lock(v_old_at)");
    expect(save).toContain("v_after < 0 and v_after < v_before");
    expect(save).toContain("pg_advisory_xact_lock(hashtext('assets:id'))");
    expect(save).toContain("'purchase_order_id', v_po_id");
    expect(save).toContain("'line_count', v_line_count");
  });

  it("the header names the base migration, the triggers and the deploy order, and adds no table", () => {
    const header = raw.slice(0, raw.indexOf("\ncreate or replace function")).toLowerCase();
    expect(header).toContain("0112");
    expect(header).toContain("trg_purchase_orders_touch");
    expect(header).toContain("deploy order");
    expect(m).not.toContain("create table");
  });
});
