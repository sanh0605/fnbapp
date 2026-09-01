import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// docs/superpowers/plans/2026-09-02-close-the-pos-function-grants.md section
// 1.4's trap: the two-line pattern recent migrations use (revoke from
// authenticated, grant to service_role) is not enough here, because these
// functions were never revoked from anything -- `from public` is the line
// that actually matters, since PUBLIC's default EXECUTE grant would let
// `authenticated` straight back in even after an explicit `authenticated`
// revoke.
//
// Confirmed red before the fix: temporarily removed the three `from
// public.create_pos_order_atomic(...) from public;` / `from anon;`
// statements' `from public` and `from anon` lines from a working copy of
// this migration (leaving only the `from authenticated` / `grant ...
// service_role` pair, i.e. exactly the "two-line pattern" the plan warns
// is insufficient here) and re-ran this suite -- the "revokes public and
// anon" assertions below failed for the right reason, a missing STATEMENT
// (the `from public`/`from anon` lines were absent from the file), not a
// wrong value. Restored the real migration content afterward, confirmed
// byte-identical to the version written for this task.
const MIGRATION_FILE = "0091_close_pos_function_grants.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

// Signature re-measured live against the server 2026-09-02 via
// pg_get_function_identity_arguments -- not copied from the plan or an
// older migration file. Both POS functions share this exact signature.
const POS_FN_ARGS = "text, jsonb, jsonb, jsonb, text, jsonb";

function expectFullyRevokedAndGranted(migration: string, functionCall: string) {
  for (const role of ["public", "anon", "authenticated"]) {
    expect(migration).toContain(
      `revoke all on function ${functionCall} from ${role};`,
    );
  }
  expect(migration).toContain(
    `grant execute on function ${functionCall} to service_role;`,
  );
}

describe("close the POS function grants (0091)", () => {
  it("revokes create_pos_order_atomic from public, anon, and authenticated, and grants only service_role", () => {
    const migration = readMigration();
    expectFullyRevokedAndGranted(
      migration,
      `public.create_pos_order_atomic(\n  ${POS_FN_ARGS}\n)`,
    );
  });

  it("revokes create_pos_order_atomic_unvalidated_0025 from public, anon, and authenticated, and grants only service_role", () => {
    const migration = readMigration();
    expectFullyRevokedAndGranted(
      migration,
      `public.create_pos_order_atomic_unvalidated_0025(\n  ${POS_FN_ARGS}\n)`,
    );
  });

  // get_my_role() surfaced by this migration's own required sweep (plan
  // section 2.1), not one of OPEN-ITEMS 81's original two. It is dead
  // (zero callers found live, this app authenticates via NextAuth against
  // its own users table, not Supabase Auth) so it is revoked but not
  // re-granted to service_role -- nothing in this codebase calls it.
  it("revokes get_my_role from public, anon, and authenticated, and grants it to no one", () => {
    const migration = readMigration();
    for (const role of ["public", "anon", "authenticated"]) {
      expect(migration).toContain(
        `revoke all on function public.get_my_role() from ${role};`,
      );
    }
    expect(migration).not.toContain("grant execute on function public.get_my_role()");
  });

  // The other three functions the sweep found (touch_updated_at,
  // stock_ledger_apply_inventory_balance_delta, rls_auto_enable) all
  // RETURN trigger/event_trigger and are structurally uncallable via
  // direct SQL or PostgREST RPC regardless of grants. This migration must
  // not touch them -- revoking their grants risks the trigger machinery
  // wired to 19 tables for zero security benefit.
  it("does not touch the three trigger/event-trigger functions the sweep also found", () => {
    const migration = readMigration();
    for (const fn of [
      "touch_updated_at",
      "stock_ledger_apply_inventory_balance_delta",
      "rls_auto_enable",
    ]) {
      expect(migration).not.toMatch(
        new RegExp(`revoke all on function public\\.${fn}\\(`),
      );
      expect(migration).not.toMatch(
        new RegExp(`grant execute on function public\\.${fn}\\(`),
      );
    }
  });
});
