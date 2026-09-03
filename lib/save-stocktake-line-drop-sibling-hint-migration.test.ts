import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// section 1.4/3: save_stocktake_line_atomic is the one function that used
// base_ingredient_id in a lookup condition (the sibling-item query), not
// just a pass-through. BR-INV-005's refusal itself must survive
// unconditionally -- only the sibling suggestion appended to it is lost.
//
// Confirmed red before the fix: temporarily reintroduced the sibling
// lateral-join block and its two variables into a working copy of this
// migration, then re-ran this suite -- the "no longer builds a sibling
// clause" and "no longer selects base_ingredient_id" assertions below
// failed for the right reason (the migration text still contained
// base_ingredient_id/v_sibling_summary), not a missing file or function.
// Restored the real fix afterward, confirmed byte-identical.
const MIGRATION_FILE = "0092_save_stocktake_line_drop_sibling_hint.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

// The migration's own header comment legitimately names base_ingredient_id
// and the sibling clause while explaining why they were removed -- a plain
// substring check would misclassify that explanatory prose as the real
// statement still being present (the same trap docs/superpowers/plans/
// 2026-09-01-phase-d-blockers.md section 5.2 names for the live
// pg_get_functiondef check). Strip `--` line comments before searching.
function readMigrationCodeOnly(): string {
  return readMigration()
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("save_stocktake_line_atomic (0092): drops the sibling hint, keeps the refusal", () => {
  it("no longer mentions base_ingredient_id in real code", () => {
    const migration = readMigrationCodeOnly();
    expect(migration.toLowerCase()).not.toContain("base_ingredient_id");
  });

  it("no longer builds a sibling summary or sibling clause in real code", () => {
    const migration = readMigrationCodeOnly();
    expect(migration).not.toContain("v_sibling_summary");
    expect(migration).not.toContain("v_sibling_clause");
    expect(migration).not.toContain("Mặt hàng cùng nguyên liệu gốc");
    expect(migration).not.toContain("Không có mặt hàng nào khác cùng nguyên liệu gốc");
  });

  // BR-INV-005 itself: counting more than everything ever purchased is
  // still refused unconditionally. The refused number, the total
  // purchased, the item name and id, and the "maybe a receipt got
  // recorded against the wrong item code" suggestion (not sibling-
  // specific) all survive -- only the third, sibling-listing sentence is
  // gone.
  it("still refuses a count over total purchased, with the same first two sentences", () => {
    const migration = readMigration();
    expect(migration).toContain("if p_counted_qty > v_total_purchased then");
    expect(migration).toContain(
      "raise exception 'Số đếm % vượt tổng đã mua % của % (%). Có thể đơn nhập đã bị ghi nhầm sang mã khác.',\n        p_counted_qty, v_total_purchased, v_item_name, v_item_reference;",
    );
  });

  // Same invariant lib/save-stocktake-line-migration.test.ts pins for 0087:
  // theoretical_at_count for a PURCHASED_ITEM line is computed the same
  // way, unaffected by this change.
  it("still computes theoretical_at_count for PURCHASED_ITEM lines unchanged", () => {
    const migration = readMigration();
    expect(migration).toContain("v_theoretical := v_total_purchased - v_total_issued;");
    expect(migration).toContain("from public.purchase_order_lines pol");
    expect(migration).toContain("from public.stock_issues\n    where purchased_item_id = v_item_reference;");
  });
});
