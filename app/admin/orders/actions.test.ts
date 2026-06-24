import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin order edit COGS calculation", () => {
  it("uses FIFO COGS instead of the legacy MAC calculator", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(editOrderSource).not.toContain("computeLineCostAtSale");
    expect(source).toContain("computeLineCostFIFO");
    expect(source).toContain("FIFOTracker");
  });
});
