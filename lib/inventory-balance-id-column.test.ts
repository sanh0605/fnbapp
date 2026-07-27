import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration 0039: hotfix inventory_balances missing id column", () => {
  const sql = readFileSync(
    resolve(__dirname, "../supabase/migrations/0039_add_id_to_inventory_balances.sql"),
    "utf8",
  ).toLowerCase();

  it("adds id as the real primary key, backfilled from item_reference, keeping item_reference unique", () => {
    expect(sql).toContain("alter table public.inventory_balances add column if not exists id text");
    expect(sql).toContain("update public.inventory_balances set id = item_reference where id is null");
    expect(sql).toContain("add constraint inventory_balances_pkey primary key (id)");
    expect(sql).toContain("add constraint inventory_balances_item_reference_key unique (item_reference)");
  });

  it("populates id on every insert path so future writes stay consistent", () => {
    expect(sql).toContain("insert into public.inventory_balances (id, item_reference, quantity, updated_at)");
    expect(sql).not.toContain("insert into public.inventory_balances (item_reference, quantity, updated_at)");
  });
});
