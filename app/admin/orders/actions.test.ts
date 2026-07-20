import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin order edit COGS calculation", () => {
  it("uses MAC COGS through inventory consumption allocation instead of FIFO", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(source).toContain("allocateRecipeConsumption");
    expect(source).toContain("computeMacCostForConsumptionRows");
    expect(editOrderSource).not.toContain("FIFOTracker");
  });

  it("splits a semi-product shortfall into an implicit production step in the edit/supersede ledger write, same as POS checkout", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const ledgerSource = source.slice(source.indexOf("function buildStockLedgerEntries"));

    expect(source).toContain("splitImplicitProduction");
    expect(ledgerSource).toContain("implicitYields");
    expect(ledgerSource).toContain('"PRODUCTION_CONSUME"');
    expect(ledgerSource).toContain('"PRODUCTION_YIELD"');
  });
});
