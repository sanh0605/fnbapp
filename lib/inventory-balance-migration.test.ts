import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration 0038: materialize inventory balances", () => {
  const sql = readFileSync(
    resolve(__dirname, "../supabase/migrations/0038_materialize_inventory_balances.sql"),
    "utf8",
  ).toLowerCase();

  it("creates the derived balance table with no foreign key to the catalog", () => {
    expect(sql).toContain("create table if not exists public.inventory_balances");
    expect(sql).toContain("item_reference text primary key");
    expect(sql).not.toContain("references public.base_ingredients");
    expect(sql).not.toContain("references public.semi_products");
  });

  it("locks the table down to service_role only, same as every other transactional table", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table public.inventory_balances from public, anon, authenticated");
    expect(sql).toContain("grant select on table public.inventory_balances to service_role");
  });

  it("maintains the balance synchronously from every committed stock_ledger mutation", () => {
    expect(sql).toContain("after insert or delete or update of item_reference, quantity_change");
    expect(sql).toContain("on public.stock_ledger");
    expect(sql).toContain("on conflict (item_reference) do update");
    expect(sql).toContain("old.quantity_change");
    expect(sql).toContain("new.quantity_change");
  });

  it("backfills from existing ledger history before the trigger takes over", () => {
    expect(sql).toContain("insert into public.inventory_balances (item_reference, quantity, updated_at)\nselect item_reference, sum(quantity_change)");
  });

  it("provides a privileged, manual-only rebuild path for recovery", () => {
    expect(sql).toContain("function public.rebuild_inventory_balances()");
    expect(sql).toContain("truncate table public.inventory_balances");
    expect(sql).toContain("revoke all on function public.rebuild_inventory_balances() from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.rebuild_inventory_balances() to service_role");
  });
});
