import { describe, it, expect } from "vitest";
import { checkLineCeiling } from "./line-ceiling-core";

describe("checkLineCeiling", () => {
  it("fails a doc over the ceiling", () => {
    const r = checkLineCeiling([{ path: "docs/03-workflows/sales.md", lineCount: 260 }], 200, new Set());
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("sales.md");
  });

  it("passes an over-ceiling file that is exempt", () => {
    const r = checkLineCeiling([{ path: "CLAUDE.md", lineCount: 316 }], 200, new Set(["CLAUDE.md"]));
    expect(r.ok).toBe(true);
  });
});
