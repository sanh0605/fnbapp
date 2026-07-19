import { describe, expect, it } from "vitest";
import { categorize } from "./generate-script-cleanup-plan-core";

describe("script cleanup plan categorization", () => {
  it("classifies audit-*/check-* as KEEP_AUDIT", () => {
    expect(categorize("audit-current-stock.ts").category).toBe("KEEP_AUDIT");
    expect(categorize("check-mac.ts").category).toBe("KEEP_AUDIT");
  });

  it("classifies lock-*/recover-* as KEEP_MIGRATION_HISTORY (the fix)", () => {
    expect(categorize("lock-btp-recipe-replay-drift-cohort.ts").category).toBe("KEEP_MIGRATION_HISTORY");
    expect(categorize("lock-backdated-historical-gap-cohort.ts").category).toBe("KEEP_MIGRATION_HISTORY");
    expect(categorize("recover-mac-drift.ts").category).toBe("KEEP_MIGRATION_HISTORY");
    expect(categorize("recover-task-3.ts").category).toBe("KEEP_MIGRATION_HISTORY");
  });

  it("still classifies migrate-*/re-migrate-* as KEEP_MIGRATION_HISTORY", () => {
    expect(categorize("migrate-sheet-to-supabase.ts").category).toBe("KEEP_MIGRATION_HISTORY");
    expect(categorize("re-migrate-v1-to-v2.ts").category).toBe("KEEP_MIGRATION_HISTORY");
  });

  it("still classifies genuine one-off investigation scripts as DELETE_ONE_OFF", () => {
    expect(categorize("investigate-task-3.4-outside-cohort.ts").category).toBe("DELETE_ONE_OFF");
    expect(categorize("debug-mac.ts").category).toBe("DELETE_ONE_OFF");
    expect(categorize("verify-drive-backup.ts").category).toBe("DELETE_ONE_OFF");
  });

  it("does not let lock-/recover- accidentally match a script that merely contains the substring", () => {
    // "unlock-" or "-recover-" mid-name should not match the startsWith() prefix check.
    expect(categorize("audit-unlock-thing.ts").category).toBe("KEEP_AUDIT");
  });
});
