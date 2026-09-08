// tests/migrations/cash-book-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0101_cash_book.sql"),
  "utf8",
);
const migration = raw.toLowerCase();

describe("cash book migration", () => {
  it("creates the three tables", () => {
    expect(migration).toContain("create table if not exists public.cash_categories");
    expect(migration).toContain("create table if not exists public.bank_accounts");
    expect(migration).toContain("create table if not exists public.cash_entries");
  });

  it("gives every new table all six audit columns", () => {
    for (const col of [
      "created_at timestamptz not null default now()",
      "created_by_id text",
      "created_by_name text",
      "updated_at timestamptz not null default now()",
      "updated_by_id text",
      "updated_by_name text",
    ]) {
      // three tables, so three occurrences of each column
      expect(migration.split(col).length - 1).toBe(3);
    }
  });

  it("reuses the existing touch_updated_at trigger on all three", () => {
    for (const t of ["cash_categories", "bank_accounts", "cash_entries"]) {
      expect(migration).toContain(
        `create trigger trg_${t}_touch before update on public.${t}`,
      );
    }
    expect(migration).toContain("execute function public.touch_updated_at()");
    // The function already exists; this migration must not redefine it.
    expect(migration).not.toContain("create or replace function public.touch_updated_at");
  });

  it("never lets a ledger row block deleting a user account", () => {
    expect(migration).not.toContain("created_by_id text references public.users");
    expect(migration).not.toContain("updated_by_id text references public.users");
  });

  it("keeps the side of the ledger on the category, not the entry", () => {
    expect(migration).toContain("kind text not null check (kind in ('expense','income'))");
    expect(migration).toContain("affects_pnl boolean not null");
    expect(migration).not.toContain("direction");
  });

  it("restricts the two foreign keys so history cannot be orphaned", () => {
    expect(migration).toContain(
      "category_id text not null references public.cash_categories(id) on delete restrict",
    );
    expect(migration).toContain(
      "bank_account_id text references public.bank_accounts(id) on delete restrict",
    );
  });

  it("forces a bank account on transfers and forbids one on cash", () => {
    expect(migration).toContain("cash_entries_bank_account_check");
    expect(migration).toContain("payment_method = 'bank_transfer' and bank_account_id is not null");
    expect(migration).toContain("payment_method = 'cash' and bank_account_id is null");
  });

  it("keeps amounts positive and status limited to active/cancelled", () => {
    expect(migration).toContain("amount bigint not null check (amount > 0)");
    expect(migration).toContain(
      "status text not null default 'active' check (status in ('active','cancelled'))",
    );
  });

  it("seeds the five categories the owner named", () => {
    for (const name of ["vận hành", "điện, nước, gas", "marketing", "thu khác", "vốn góp"]) {
      expect(migration).toContain(name);
    }
    expect(migration).toContain("cfc-001");
    expect(migration).toContain("cfc-005");
  });

  it("exposes the tables only to service_role", () => {
    for (const t of ["cash_categories", "bank_accounts", "cash_entries"]) {
      expect(migration).toContain(`alter table public.${t} enable row level security`);
      expect(migration).toContain(`revoke all on table public.${t} from public, anon, authenticated`);
    }
  });

  it("pins the exact casing of every value the application will compare against", () => {
    // Postgres string comparison is case-sensitive, and the checks above
    // fold everything to lowercase before asserting -- so they cannot see a
    // future edit that changes case (e.g. 'Expense' instead of 'EXPENSE').
    // Application code in later tasks writes and reads these exact literals,
    // so this test reads the file WITHOUT lowercasing to pin the real casing.
    expect(raw).toContain("check (kind in ('EXPENSE','INCOME'))");
    expect(raw).toContain("check (payment_method in ('CASH','BANK_TRANSFER'))");
    expect(raw).toContain("check (status in ('ACTIVE','INACTIVE'))");
    expect(raw).toContain("check (status in ('ACTIVE','CANCELLED'))");
    for (const id of ["CFC-001", "CFC-002", "CFC-003", "CFC-004", "CFC-005"]) {
      expect(raw).toContain(`'${id}'`);
    }
    expect(raw).toContain("default 'CASH'");
    expect(raw).toContain("default 'ACTIVE'");
  });
});
