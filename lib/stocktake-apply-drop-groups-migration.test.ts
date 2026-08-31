import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// docs/superpowers/plans/2026-09-01-delete-tier-2-ingredient-groups.md
// section 3's second check, for apply_stocktake_session_atomic: no function
// still mentions base_ingredients, checked against the server via
// pg_get_functiondef with comments stripped -- this file pins the same
// property for the migration text (the live check cannot run without
// applying the migration, forbidden this task). Confirmed red before the
// fix: temporarily reintroduced the group-aggregation loop this migration
// removes and confirmed the assertion below failed for the right reason (a
// wrong VALUE -- the migration text containing "public.base_ingredients" --
// not a missing file or function), before restoring the real fix.
const MIGRATION_FILE = "0089_delete_tier2_groups_stocktake_fix.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

describe("apply_stocktake_session_atomic (0089): no longer reads base_ingredients", () => {
  it("never reads the table", () => {
    const migration = readMigration().toLowerCase();
    expect(migration).not.toContain("public.base_ingredients");
  });

  // The PURCHASED_ITEM branch is the only one any real stocktake line has
  // ever used (confirmed live 2026-09-01: 50/50 stocktake_lines rows are
  // PURCHASED_ITEM) -- pin it down unchanged so this fix can't quietly
  // widen into the live path.
  it("still computes count_variance for PURCHASED_ITEM lines unchanged", () => {
    const migration = readMigration();
    expect(migration).toContain("v_count_variance := v_line.counted_qty - v_line.theoretical_at_count;");
    expect(migration).toContain("from public.purchase_order_lines pol");
    expect(migration).toContain(
      "insert into public.stock_issues (\n        id, purchased_item_id, issued_at, base_quantity, source, session_id, note\n      )",
    );
  });

  // ledger_count / skipped_ingredients stay in the return shape (read by
  // lib/stocktake-transaction.ts) -- only their producer (the removed loop)
  // is gone, not the keys themselves.
  it("still returns ledger_count and skipped_ingredients in both branches", () => {
    const migration = readMigration();
    const returnBlocks = migration.match(/return jsonb_build_object\(([\s\S]*?)\);/g) ?? [];
    expect(returnBlocks).toHaveLength(2);
    for (const block of returnBlocks) {
      expect(block).toContain("'ledger_count', v_ledger_count");
      expect(block).toContain("'skipped_ingredients', v_skipped_ingredients");
    }
  });
});
