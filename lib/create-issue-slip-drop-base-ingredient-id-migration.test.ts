import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// docs/superpowers/plans/2026-09-01-drop-base-ingredient-id-column.md
// section 1.3/2.2: create_issue_slip_atomic only ever read
// base_ingredient_id to relay it per line in the return payload -- a
// pass-through, never used in the purchase-before-issue check, the
// over-issue check, or the running-balance math (all keyed on
// purchased_item_id). Last of the three functions per the plan's own
// ordering: issue slips go last.
//
// Confirmed red before the fix: temporarily reintroduced
// `, base_ingredient_id into v_item_name, v_base_ingredient_id` on the
// item-name select and the `'base_ingredient_id', v_base_ingredient_id,`
// return key into a working copy of this migration, then re-ran this
// suite -- the "no longer reads or returns" assertion failed for the
// right reason (the migration text still contained both), not a missing
// file or function. Restored the real fix afterward, confirmed
// byte-identical.
const MIGRATION_FILE = "0094_create_issue_slip_drop_base_ingredient_id.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

// Strip `--` line comments before searching -- same reasoning as 0092's
// and 0093's tests: the header comment legitimately names
// base_ingredient_id while explaining the removal.
function readMigrationCodeOnly(): string {
  return readMigration()
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("create_issue_slip_atomic (0094): drops base_ingredient_id entirely", () => {
  it("no longer reads or returns base_ingredient_id in real code", () => {
    const migration = readMigrationCodeOnly();
    expect(migration.toLowerCase()).not.toContain("base_ingredient_id");
  });

  // I4 (purchase-before-issue), I5 (over-issue), and I10 (cumulative
  // running balance across lines naming the same item) are all keyed on
  // purchased_item_id, unaffected by this change.
  it("still refuses issuing before any purchase, and refuses over-issue against the running balance", () => {
    const migration = readMigration();
    expect(migration).toContain(
      "raise exception 'Dòng % (%): chưa có đơn nhập nào tính tới thời điểm %, không thể xuất trước khi nhập',",
    );
    expect(migration).toContain(
      "raise exception 'Dòng % (%): yêu cầu xuất % %, chỉ còn % % tính tới thời điểm % (đã trừ các dòng khác cùng mặt hàng trong phiếu này)',",
    );
  });

  it("unit name for the over-issue message still comes from uom_conversions, not base_ingredients", () => {
    const migration = readMigration();
    expect(migration).toContain(
      "from public.uom_conversions uc join public.units u on u.id = uc.base_unit\n      where uc.purchased_item_id = v_line.purchased_item_id and uc.status = 'ACTIVE'",
    );
  });

  it("return payload's per-line shape still carries purchased_item_id and base_quantity, no ledger_id", () => {
    const migration = readMigration();
    expect(migration).toContain("'purchased_item_id', v_line.purchased_item_id,");
    expect(migration).toContain("'base_quantity', v_line.base_quantity,");
    expect(migration.toLowerCase()).not.toContain("ledger_id");
  });
});
