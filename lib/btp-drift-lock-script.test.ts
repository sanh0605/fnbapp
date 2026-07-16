import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "scripts/lock-btp-recipe-replay-drift-cohort.ts",
  "utf8",
);

describe("Task 3.7 lock CLI safety shape", () => {
  it("is dry-run by default and gates its only cohort insert behind --apply", () => {
    expect(source).toContain('process.argv.includes("--apply")');
    expect(source).toContain('if (!apply)');
    expect(source.match(/\.insert\(/g)).toHaveLength(1);
    expect(source).not.toContain(".upsert(");
    expect(source).not.toContain("onConflict");
  });

  it("verifies the post-apply count, unchanged costs, and lock trigger", () => {
    expect(source).toContain("BTP_DRIFT_FINAL_LOCK_COUNT");
    expect(source).toContain("verifyCostsUnchanged");
    expect(source).toContain("verifyTriggerBlocksUpdate");
    expect(source).toContain("audit-baseline locked");
  });

  it("reports an insert error without retrying a partial state", () => {
    expect(source).toContain("inspectFailedInsertState");
    expect(source).toContain("Do not retry automatically");
    expect(source.match(/\.insert\(/g)).toHaveLength(1);
  });
});
