// tests/migrations/cash-book-money-flow-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0107_cash_book_money_flow.sql"),
  "utf8",
);
const migration = raw.toLowerCase();

function fnBody(): string {
  const m = raw.match(/\$function\$([\s\S]*?)\$function\$/);
  if (!m) throw new Error("save_purchase_order_atomic body not found");
  return m[1];
}

describe("0107: cash book money flow", () => {
  it("creates cash_transfers with its checks, restrict keys, trigger and service-role-only grants", () => {
    expect(migration).toContain("create table public.cash_transfers");
    expect(migration).toContain("check (amount > 0)");
    expect(migration).toContain("from_account_id is distinct from to_account_id");
    expect(migration).toMatch(/from_account_id text references public\.bank_accounts\(id\) on delete restrict/);
    expect(migration).toMatch(/to_account_id text references public\.bank_accounts\(id\) on delete restrict/);
    expect(migration).toContain(
      "create trigger trg_cash_transfers_touch before update on public.cash_transfers",
    );
    expect(migration).toContain("execute function public.touch_updated_at()");
    expect(migration).toContain("alter table public.cash_transfers enable row level security");
    expect(migration).toContain(
      "revoke all on table public.cash_transfers from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.cash_transfers to service_role",
    );
    expect(migration).not.toMatch(/grant [^;]*cash_transfers to (anon|authenticated)/);
  });

  it("adds payment_method with default CASH, then drops the default", () => {
    expect(migration).toContain("add column payment_method text default 'cash'");
    expect(migration).toContain(
      "alter table public.purchase_orders alter column payment_method drop default",
    );
    expect(migration.indexOf("add column payment_method")).toBeLessThan(
      migration.indexOf("alter column payment_method drop default"),
    );
    expect(migration).toMatch(/add column[\s\S]*bank_account_id text references public\.bank_accounts\(id\) on delete restrict/);
  });

  it("adds the three purchase order checks", () => {
    expect(migration).toContain("purchase_orders_payment_method_valid");
    expect(migration).toContain("purchase_orders_completed_has_payment");
    expect(migration).toContain("check (status <> 'completed' or payment_method is not null)");
    expect(migration).toContain("purchase_orders_account_matches_method");
    expect(migration).toContain("bank_account_id is not null");
  });

  it("creates the cash_book_daily view on Saigon days for completed rows only", () => {
    expect(migration).toContain("create view public.cash_book_daily");
    expect(migration).toContain("security_invoker = true");
    expect(migration.split("at time zone 'asia/saigon'").length - 1).toBe(2);
    expect(migration).not.toContain("asia/ho_chi_minh");
    expect(migration).toContain("o.status = 'completed'");
    expect(migration).toMatch(/from public\.purchase_orders where status = 'completed'/);
    expect(migration).toContain("count(distinct id)");
    expect(migration).toContain(
      "revoke all on public.cash_book_daily from public, anon, authenticated",
    );
    expect(migration).toContain("grant select on public.cash_book_daily to service_role");
  });

  it("re-creates save_purchase_order_atomic with the same signature", () => {
    expect(migration).toContain(
      "create or replace function public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb default '[]'::jsonb, p_replace_existing boolean default false)",
    );
    // No drop: same signature, so no overload can be left behind.
    expect(migration).not.toContain("drop function");
    expect(migration).toContain(
      "grant execute on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) to service_role",
    );
  });

  it("writes payment_method and bank_account_id in both the replace and the insert branch", () => {
    const body = fnBody();
    const insertAt = body.indexOf("insert into public.purchase_orders");
    expect(insertAt).toBeGreaterThan(0);
    const replaceBranch = body.slice(0, insertAt);
    const insertBranch = body.slice(insertAt);
    for (const branch of [replaceBranch, insertBranch]) {
      expect(branch).toContain("nullif(p_order->>'payment_method', '')");
      expect(branch).toContain("nullif(p_order->>'bank_account_id', '')");
    }
    expect(replaceBranch).toMatch(/payment_method = nullif/);
    expect(replaceBranch).toMatch(/bank_account_id = nullif/);
    // Column list of the insert names both fields.
    const columnList = insertBranch.slice(0, insertBranch.indexOf("values ("));
    expect(columnList).toContain("payment_method");
    expect(columnList).toContain("bank_account_id");
  });

  it("keeps the rest of the 0078 body (ledger write stays retired)", () => {
    const body = fnBody();
    expect(body).not.toContain("stock_ledger");
    expect(body).toContain("pg_advisory_xact_lock(hashtext('purchase_orders:id'))");
    expect(body).toContain("delete from public.purchase_order_lines");
  });
});
