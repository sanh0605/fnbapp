import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// section 3's first
// check: "no function still mentions stock_ledger or inventory_balances --
// checked against the latest body of every function, not by name." This
// migration is that check made permanent for apply_stocktake_session_atomic,
// not a one-off measurement: once applied, stock_ledger/inventory_balances
// can be dropped (a future, separately approved phase D) without this
// function erroring the moment the table disappears.
//
// Confirmed red before the fix, against these exact two files (not the
// original 0059/2026-08-07-era migration, which can drift): temporarily
// reintroduced the two `select ... from public.stock_ledger` reads this
// migration removes and confirmed both assertions below failed, for the
// right reason (a wrong VALUE -- the string is present -- not a missing
// file or function), before restoring the real fix.
const MIGRATION_FILE = "0086_phase_d_blocker_apply_stocktake.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

describe("apply_stocktake_session_atomic (0086): no longer reads stock_ledger or inventory_balances", () => {
  it("never mentions either table", () => {
    const migration = readMigration().toLowerCase();
    expect(migration).not.toContain("public.stock_ledger");
    expect(migration).not.toContain("public.inventory_balances");
  });

  // Section 3's most important check, restated as a structural guarantee
  // rather than a one-time diff: the lines computing count_variance (the
  // value that actually drives a stocktake close -- the stock_issues rows
  // it writes, and the COGS those produce) must be present, unchanged, in
  // the new body. If a future edit ever touches either line, this test
  // forces a conscious re-verification of section 3's dry-run-comparison
  // requirement, not a silent pass.
  it("still computes count_variance from the frozen stocktake_lines value, not stock_ledger", () => {
    const migration = readMigration();
    expect(migration).toContain(
      "v_count_variance := v_line.counted_qty - v_line.theoretical_at_count;",
    );
    expect(migration).toContain(
      "select coalesce(sum(sl4.counted_qty - sl4.theoretical_at_count), 0)\n    into v_ingredient_variance",
    );
  });
});
