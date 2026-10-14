// tests/migrations/dashboard-settings-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0109_dashboard_settings.sql"),
  "utf8",
).toLowerCase();

// Collapse whitespace so assertions do not depend on line breaks.
const flat = migration.replace(/\s+/g, " ");

describe("dashboard settings migration", () => {
  it("creates the three tables", () => {
    expect(flat).toContain("create table if not exists public.product_types");
    expect(flat).toContain("create table if not exists public.monthly_expense_items");
    expect(flat).toContain("create table if not exists public.dashboard_settings");
  });

  it("gives product_types no status column and a drink flag", () => {
    const block = flat.slice(
      flat.indexOf("create table if not exists public.product_types"),
      flat.indexOf("create table if not exists public.monthly_expense_items"),
    );
    expect(block).not.toContain("status");
    expect(block).toContain("is_drink boolean not null default false");
    expect(block).toContain("created_at timestamptz");
  });

  it("seeds the three product types", () => {
    expect(flat).toMatch(/'pt-001', 'thức uống', true/);
    expect(flat).toMatch(/'pt-002', 'thức ăn', false/);
    expect(flat).toMatch(/'pt-003', 'topping', false/);
  });

  it("keeps product type names unique", () => {
    expect(flat).toContain("create unique index if not exists idx_product_types_name");
  });

  it("adds product_categories.type_id with restrict and a temporary default", () => {
    expect(flat).toContain(
      "alter table public.product_categories add column if not exists type_id text default 'pt-001' references public.product_types(id) on delete restrict",
    );
  });

  it("backfills all seven categories, deleted CAT-003 included", () => {
    expect(flat).toMatch(
      /update public\.product_categories set type_id = 'pt-001' where id in \('cat-001', 'cat-002', 'cat-003', 'cat-004', 'cat-005'\)/,
    );
    expect(flat).toMatch(/set type_id = 'pt-002' where id = 'cat-006'/);
    expect(flat).toMatch(/set type_id = 'pt-003' where id = 'cat-007'/);
  });

  it("fails loudly when a category is still untyped, then sets not null last", () => {
    const check = flat.indexOf("raise exception");
    const notNull = flat.indexOf(
      "alter table public.product_categories alter column type_id set not null",
    );
    const lastBackfill = flat.indexOf("where id = 'cat-007'");
    expect(lastBackfill).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(lastBackfill);
    expect(notNull).toBeGreaterThan(check);
  });

  it("defines monthly_expense_items with the audit columns and restrict", () => {
    const block = flat.slice(
      flat.indexOf("create table if not exists public.monthly_expense_items"),
      flat.indexOf("create table if not exists public.dashboard_settings"),
    );
    expect(block).toContain(
      "cash_category_id text not null references public.cash_categories(id) on delete restrict",
    );
    expect(block).toContain(
      "status text not null default 'active' check (status in ('active','inactive'))",
    );
    for (const col of [
      "created_at timestamptz not null default now()",
      "created_by_id text",
      "created_by_name text",
      "updated_at timestamptz not null default now()",
      "updated_by_id text",
      "updated_by_name text",
    ]) {
      expect(block).toContain(col);
    }
  });

  it("keeps ACTIVE monthly item names unique", () => {
    expect(flat).toMatch(
      /create unique index if not exists idx_monthly_expense_items_active_name on public\.monthly_expense_items \(.*\) where status = 'active'/,
    );
  });

  it("adds a nullable cash_entries.monthly_item_id with restrict", () => {
    expect(flat).toContain(
      "alter table public.cash_entries add column if not exists monthly_item_id text references public.monthly_expense_items(id) on delete restrict",
    );
    expect(flat).not.toMatch(/monthly_item_id text not null/);
  });

  it("defines the single-row dashboard_settings with its ranges and defaults", () => {
    expect(flat).toContain("id int primary key check (id = 1)");
    expect(flat).toContain(
      "stale_stocktake_days int not null default 30 check (stale_stocktake_days between 1 and 365)",
    );
    expect(flat).toContain(
      "open_stocktake_days int not null default 2 check (open_stocktake_days between 1 and 365)",
    );
    expect(flat).toContain(
      "reminder_start_day int not null default 25 check (reminder_start_day between 1 and 28)",
    );
    expect(flat).toContain(
      "food_product_ids text[] not null default '{prod-028,prod-027}'",
    );
    expect(flat).toContain(
      "topping_type_id text default 'pt-003' references public.product_types(id) on delete set null",
    );
    expect(flat).toMatch(/insert into public\.dashboard_settings \(id\) values \(1\) on conflict/);
  });

  it("uses on delete set null only for the topping type", () => {
    expect(flat.split("on delete set null").length - 1).toBe(1);
    expect(flat.split("on delete restrict").length - 1).toBe(3);
  });

  it("reuses touch_updated_at and does not redefine it", () => {
    for (const t of ["monthly_expense_items", "dashboard_settings"]) {
      expect(flat).toContain(`create trigger trg_${t}_touch before update on public.${t}`);
    }
    expect(flat).not.toContain("create or replace function");
  });

  it("locks the new tables to service_role like the cash book", () => {
    for (const t of ["product_types", "monthly_expense_items", "dashboard_settings"]) {
      expect(flat).toContain(`alter table public.${t} enable row level security`);
      expect(flat).toContain(`revoke all on table public.${t} from public, anon, authenticated`);
      expect(flat).toContain(
        `grant select, insert, update, delete on table public.${t} to service_role`,
      );
    }
  });

  it("is additive: drops nothing and changes no function", () => {
    expect(flat).not.toMatch(/drop (table|column|function)/);
    expect(flat).not.toContain("create or replace function");
  });

  it("lists the triggers found in migration text, naming the source", () => {
    expect(flat).toContain("read from migration text, not queried live");
    expect(flat).toContain("trg_cash_entries_touch");
    expect(flat).toMatch(/product_categories[^.]*no trigger/);
  });
});
