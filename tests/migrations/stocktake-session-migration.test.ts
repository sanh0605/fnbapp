import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/0036_stocktake_sessions.sql"),
  "utf8",
).toLowerCase();

describe("0036 stocktake sessions migration", () => {
  it("keeps one open session and records both creator and confirmer identity", () => {
    expect(sql).toContain("idx_stocktake_sessions_one_open");
    expect(sql).toContain("where status = 'open'");
    expect(sql).toContain("created_by_id text not null");
    expect(sql).toContain("created_by_name text not null");
    expect(sql).toContain("confirmed_by_id text");
    expect(sql).toContain("confirmed_by_name text");
  });

  it("enforces complete, non-negative finite count snapshots at table level", () => {
    expect(sql).toContain("counted_qty >= 0");
    expect(sql).toContain("counted_qty <> 'nan'::numeric");
    expect(sql).toContain("counted_qty is null");
    expect(sql).toContain("theoretical_at_count is null");
    expect(sql).toContain("counted_at is null");
    expect(sql).toContain("counted_qty is not null");
    expect(sql).toContain("theoretical_at_count is not null");
    expect(sql).toContain("counted_at is not null");
  });

  it("serializes every state transition and limits RPCs to service_role", () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('stocktake_session:open'))");
    expect(sql.match(/for update/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql.match(/security definer/g)).toHaveLength(3);
    expect(sql.match(/to service_role/g)).toHaveLength(5);
    expect(sql.match(/from public, anon, authenticated/g)).toHaveLength(5);
  });
});
