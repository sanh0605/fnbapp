import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("POS order COGS calculation", () => {
  it("uses compact inventory state and one atomic database write", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const submitOrderSource = source.slice(
      source.indexOf("export async function submitOrderV2"),
      source.indexOf("function buildStockLedgerEntries"),
    );

    expect(source).toContain("getPosInventoryState");
    expect(source).toContain("computeMacCostFromUnitCosts");
    expect(source).toContain("savePosOrderAtomic");
    expect(submitOrderSource).not.toContain('findAllNoCache("Stock_Ledger")');
    expect(submitOrderSource).not.toContain("assignOrderNo");
    expect(submitOrderSource).not.toContain("ensureUniqueOrderNo");
    expect(submitOrderSource).not.toContain("insertOrderV2Records");
    expect(submitOrderSource).not.toContain("FIFOTracker");
  });

  it("uses narrow POS reads instead of full admin reports", () => {
    const pageSource = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

    expect(pageSource).toContain("getPOSBestSellerProductIds");
    expect(pageSource).toContain("getPOSStockStatus");
    expect(pageSource).not.toContain("getSalesDataV2");
    expect(pageSource).not.toContain("getRealtimeStock");
  });
});
