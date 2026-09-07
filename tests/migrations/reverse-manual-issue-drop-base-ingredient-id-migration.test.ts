import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// section 1.3/2.2: reverse_manual_issue_atomic only ever read
// base_ingredient_id to relay it in the return payload -- a pass-through,
// never used to decide anything. This migration removes the read and the
// key from the return payload; every refusal check and the reversal
// quantity math (keyed on purchased_item_id) are untouched.
//
// Confirmed red before the fix: temporarily reintroduced the
// `select base_ingredient_id into v_base_ingredient_id ...` read and the
// `'base_ingredient_id', v_base_ingredient_id,` return key into a working
// copy of this migration, then re-ran this suite -- the "no longer reads
// or returns" assertions below failed for the right reason (the migration
// text still contained both), not a missing file or function. Restored
// the real fix afterward, confirmed byte-identical.
const MIGRATION_FILE = "0093_reverse_manual_issue_drop_base_ingredient_id.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

// Strip `--` line comments before searching -- the migration's own header
// comment legitimately names base_ingredient_id while explaining the
// removal, same trap that section 5.2 names for the live pg_get_functiondef check.
function readMigrationCodeOnly(): string {
  return readMigration()
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("reverse_manual_issue_atomic (0093): drops base_ingredient_id entirely", () => {
  it("no longer reads or returns base_ingredient_id in real code", () => {
    const migration = readMigrationCodeOnly();
    expect(migration.toLowerCase()).not.toContain("base_ingredient_id");
  });

  // Every refusal (unknown issue, not MANUAL, already reversed) and the
  // negative-quantity reversal insert are keyed on purchased_item_id,
  // unaffected by this change.
  it("still checks source = MANUAL and the already-reversed guard, unchanged", () => {
    const migration = readMigration();
    expect(migration).toContain(
      "raise exception 'Chỉ đảo được phiếu xuất thủ công -- % có nguồn %, không phải MANUAL',\n      v_issue_id, v_original.source;",
    );
    expect(migration).toContain(
      "raise exception 'Phiếu % đã được đảo bởi % trước đó, không đảo hai lần', v_issue_id, v_already_reversed_by;",
    );
  });

  it("still inserts the reversal with negative base_quantity and reverses_issue_id, unchanged", () => {
    const migration = readMigration();
    expect(migration).toContain(
      "v_reversal_id, v_original.purchased_item_id, v_now, -v_original.base_quantity, 'MANUAL', null,",
    );
  });

  it("return payload still carries purchased_item_id and base_quantity, no ledger_id", () => {
    const migration = readMigration();
    expect(migration).toContain("'purchased_item_id', v_original.purchased_item_id,");
    expect(migration).toContain("'base_quantity', -v_original.base_quantity,");
    expect(migration.toLowerCase()).not.toContain("ledger_id");
  });
});
