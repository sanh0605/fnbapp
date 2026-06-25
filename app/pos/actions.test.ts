import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("POS order COGS calculation", () => {
  it("uses MAC COGS through inventory consumption allocation instead of FIFO", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const submitOrderSource = source.slice(source.indexOf("export async function submitOrderV2"));

    expect(source).toContain("allocateRecipeConsumption");
    expect(source).toContain("computeMacCostForConsumptionRows");
    expect(submitOrderSource).not.toContain("FIFOTracker");
  });
});
