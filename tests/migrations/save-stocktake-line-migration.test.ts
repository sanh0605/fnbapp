import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// section 3's first
// check, for save_stocktake_line_atomic: no function still mentions
// stock_ledger or inventory_balances. Confirmed red before the fix,
// against this exact file: temporarily reintroduced the
// `select ... from public.stock_ledger` read this migration removes and
// confirmed the assertion below failed for the right reason (a wrong
// VALUE, not a missing file or function), before restoring the real fix.
const MIGRATION_FILE = "0087_phase_d_blocker_save_stocktake_line.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

describe("save_stocktake_line_atomic (0087): no longer reads stock_ledger or inventory_balances", () => {
  it("never mentions either table", () => {
    const migration = readMigration().toLowerCase();
    expect(migration).not.toContain("public.stock_ledger");
    expect(migration).not.toContain("public.inventory_balances");
  });

  // Unlike apply_stocktake_session_atomic's two display-only sites, this
  // function's stock_ledger read fed theoretical_at_count directly -- the
  // value apply_stocktake_session_atomic later subtracts counted_qty
  // against to get count_variance. The PURCHASED_ITEM branch (the only
  // type any real line has ever used) is untouched; pin that down so a
  // future edit can't quietly widen the change into the live path.
  it("still computes theoretical_at_count for PURCHASED_ITEM lines from purchase_order_lines/stock_issues, unchanged", () => {
    const migration = readMigration();
    expect(migration).toContain("v_theoretical := v_total_purchased - v_total_issued;");
    expect(migration).toContain("from public.purchase_order_lines pol");
    expect(migration).toContain("from public.stock_issues\n    where purchased_item_id = v_item_reference;");
  });
});
