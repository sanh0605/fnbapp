import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// section 3's first check, for void_order_atomic: no function still mentions
// stock_ledger. Confirmed red before the fix, against this exact file:
// temporarily reintroduced the two `select ... from public.stock_ledger`
// reads this migration removes (v_has_reversal and v_reversal_count) and
// confirmed the assertion below failed for the right reason (a wrong VALUE
// -- the migration text containing "public.stock_ledger" -- not a missing
// file or function), before restoring the real fix.
const MIGRATION_FILE = "0088_phase_d_blocker_void_order.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

describe("void_order_atomic (0088): no longer reads stock_ledger", () => {
  it("never reads the table", () => {
    // Checking for "public.stock_ledger" (an actual read/write site), not
    // for the bare word "edit_reversal" -- the migration's own header
    // comment legitimately explains EDIT_REVERSAL's history, and a plain
    // substring check would misclassify that explanatory prose as a real
    // statement (the same trap section 5.2 of the phase-d-blockers plan
    // describes for the live pg_get_functiondef check).
    const migration = readMigration().toLowerCase();
    expect(migration).not.toContain("public.stock_ledger");
  });

  // The order_events guard (v_has_void_event) is the one real protection
  // going forward -- pin down that it is untouched, still checked before
  // the insert, and still raises the same exception text.
  it("still checks order_events for an existing VOIDED event, unchanged", () => {
    const migration = readMigration();
    expect(migration).toContain(
      "from public.order_events\n    where order_id = p_order_id\n      and event_type = 'VOIDED'",
    );
    expect(migration).toContain(
      "if v_has_void_event or v_has_reversal then\n    raise exception 'Order % has an incomplete legacy void state', p_order_id;",
    );
  });

  // reversal_count stays in the return shape (lib/void-order-transaction.ts
  // is not touched by this migration) but is always 0 now.
  it("still returns reversal_count and already_voided in both branches", () => {
    const migration = readMigration();
    const returnBlocks = migration.match(/return jsonb_build_object\(([\s\S]*?)\);/g) ?? [];
    expect(returnBlocks).toHaveLength(2);
    for (const block of returnBlocks) {
      expect(block).toContain("'order_id', p_order_id");
      expect(block).toContain("'reversal_count', v_reversal_count");
      expect(block).toContain("'already_voided'");
    }
  });
});
