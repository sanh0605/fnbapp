import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { checkMapDrift } from "./map-drift-core";

// Scope the generated side to the SEED FLOW's file, not to a table name:
// stock_issues is written by both lib/manual-issue-transaction.ts (this flow)
// and lib/stocktake-transaction.ts (a different flow). Filtering by table would
// pull the stocktake relation in and make the seed hand map look incomplete.
const FLOW_FILE = "lib/manual-issue-transaction.ts";

describe("seed proof: drift check catches a real removed relation", () => {
  const generated = readFileSync("docs/generated/system-map.md", "utf8");
  const hand = readFileSync("docs/01-system/SYSTEM-MAP.md", "utf8");
  const genFlowOnly = generated.split("\n")
    .filter(l => l.includes(FLOW_FILE) || l.includes("```")).join("\n");

  it("passes on the committed seed", () => {
    expect(checkMapDrift(genFlowOnly, hand).ok).toBe(true);
  });

  it("fails when a real relation is dropped from the hand map", () => {
    const brokenHand = hand.split("\n").filter(l => !l.includes("stock_issues")).join("\n");
    const r = checkMapDrift(genFlowOnly, brokenHand);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("stock_issues");
  });
});
