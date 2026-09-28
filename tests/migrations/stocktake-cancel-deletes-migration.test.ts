import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Owner decision 2026-09-28 (BR-INV-010): cancelling a stocktake session
// keeps nothing -- not the session, not its counted lines, not a CANCELLED
// status. Replaces 0061's "keep it CANCELLED if anything was counted".
// Pins the migration text; the live function cannot be read from here
// (supabase/CLAUDE.md: no session can query pg_catalog).
const MIGRATION_FILE = "0103_stocktake_cancel_deletes_session.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE), "utf8");
}

function cancelFunctionBody(): string {
  const migration = readMigration();
  const match = migration.match(
    /create or replace function public\.cancel_stocktake_session_atomic[\s\S]*?\$\$([\s\S]*?)\$\$/,
  );
  if (!match) throw new Error("cancel_stocktake_session_atomic not redefined in " + MIGRATION_FILE);
  return match[1];
}

describe("0103: cancelling a stocktake session deletes it", () => {
  it("deletes the session whether or not anything was counted", () => {
    const body = cancelFunctionBody();
    expect(body).toContain("delete from public.stocktake_sessions where id = v_session_id;");
    expect(body).not.toContain("'CANCELLED'");
    expect(body).not.toContain("v_any_counted");
  });

  it("still only cancels an OPEN session", () => {
    expect(cancelFunctionBody()).toContain("if v_status <> 'OPEN' then");
  });

  it("removes the sessions already left CANCELLED, refusing any that fed stock_issues", () => {
    const migration = readMigration();
    expect(migration).toMatch(/from public\.stock_issues si[\s\S]*?s\.status = 'CANCELLED'/);
    expect(migration).toContain("delete from public.stocktake_sessions where status = 'CANCELLED';");
  });

  it("drops CANCELLED from the allowed statuses, after the delete", () => {
    const migration = readMigration();
    const deleteAt = migration.indexOf("delete from public.stocktake_sessions where status = 'CANCELLED';");
    const constraintAt = migration.indexOf("check (status in ('OPEN', 'CONFIRMED', 'REVERSED'))");
    expect(constraintAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    expect(constraintAt).toBeGreaterThan(deleteAt);
  });
});
