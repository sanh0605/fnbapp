import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve("supabase/migrations/0123_kho_input_checks.sql");

function sql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8").toLowerCase();
}

describe("0123 Kho input checks migration", () => {
  it("says it is not run and records the measured counts", () => {
    const s = sql();
    expect(s).toContain("not yet run");
    expect(s).toContain("203 / 0");
    expect(s).toContain("359 / 0");
  });

  it("adds the table checks", () => {
    const s = sql();
    expect(s).toContain("subtotal_amount >= 0 and shipping_fee >= 0 and tax_amount >= 0");
    expect(s).toContain("voucher_amount >= 0 and discount_amount >= 0 and total_amount >= 0");
    expect(s).toContain("check (quantity >= 0)");
    expect(s).toContain("check (status in ('active', 'inactive'))");
    expect(s).toContain("check (quantity > 0)");
    expect(s).toContain("check (term_months > 0)");
    expect(s).toContain("check (max_unit_price is null or max_unit_price > min_unit_price)");
  });

  it("guards disposals under the asset row lock, refusing INACTIVE and over-quantity", () => {
    const s = sql();
    expect(s).toContain("from public.assets where id = new.asset_id for update");
    expect(s).toContain("if v_status = 'inactive' then");
    expect(s).toContain("if v_disposed + new.quantity > v_quantity then");
    expect(s).toContain("before insert on public.asset_disposals");
  });
});
