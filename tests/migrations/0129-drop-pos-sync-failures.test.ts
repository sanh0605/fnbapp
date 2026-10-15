import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0129_drop_pos_sync_failures.sql"),
  "utf8",
).replace(/--[^\n]*/g, "").toLowerCase();

describe("0129: drop pos_sync_failures", () => {
  it("drops only that table, with no cascade", () => {
    expect(sql).toContain("drop table if exists public.pos_sync_failures;");
    expect(sql).not.toContain("cascade");
    expect((sql.match(/drop /g) ?? []).length).toBe(1);
  });
});
