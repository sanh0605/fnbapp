// tests/migrations/cash-category-sales-revenue-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0102_cash_category_sales_revenue.sql"),
  "utf8",
).toLowerCase();

describe("cash category sales-revenue migration (BR-CASH-006)", () => {
  it("adds the flag as a non-null boolean defaulting to false", () => {
    expect(migration).toContain(
      "add column if not exists is_sales_revenue boolean not null default false",
    );
  });

  it("lets only an income category that counts in profit and loss carry the flag", () => {
    expect(migration).toContain(
      "check (not is_sales_revenue or (kind = 'income' and affects_pnl))",
    );
  });

  it("can run twice: drops the constraint before adding it", () => {
    const drop = migration.indexOf("drop constraint if exists cash_categories_sales_revenue_is_pnl_income");
    const add = migration.indexOf("add constraint cash_categories_sales_revenue_is_pnl_income");
    expect(drop).toBeGreaterThan(-1);
    expect(add).toBeGreaterThan(drop);
  });

  it("sets no row's flag -- the owner ticks it himself after release", () => {
    expect(migration).not.toMatch(/\bupdate\s+public\.cash_categories\b/);
    expect(migration).not.toMatch(/\binsert\s+into\b/);
  });
});
