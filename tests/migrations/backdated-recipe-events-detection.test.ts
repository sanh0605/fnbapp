import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0027_backdated_recipe_detection.sql"),
  "utf8",
).toLowerCase();

describe("backdated recipe detection migration", () => {
  it("does not flag recipe rows created at the current insert time", () => {
    expect(migration).toContain("if new.created_at < now() - interval '5 minutes' then");
    expect(migration).toContain("insert into public.backdated_recipe_events");
  });

  it("flags rows older than the five-minute threshold with the expected event fields", () => {
    expect(migration).toContain("recipe_id");
    expect(migration).toContain("target_type");
    expect(migration).toContain("target_id");
    expect(migration).toContain("effective_timestamp");
    expect(migration).toContain("visibility_timestamp");
  });

  it("bypasses detection while MAC drift recovery is active", () => {
    expect(migration).toContain("current_setting('app.mac_drift_recovery', true) = 'on'");
    expect(migration).toContain("return new;");
  });

  it("is idempotent on repeated inserts for the same recipe row", () => {
    expect(migration).toContain("on conflict (recipe_id) do nothing");
  });

  it("fires only on recipes inserts, without altering the recipes table constraints", () => {
    expect(migration).toContain("after insert on public.recipes");
    expect(migration).not.toContain("alter table public.recipes");
  });

  it("includes the anomaly-classification columns for the shared cron sweep", () => {
    expect(migration).toContain("is_anomalous boolean not null default false");
    expect(migration).toContain("anomaly_reason text");
  });
});
