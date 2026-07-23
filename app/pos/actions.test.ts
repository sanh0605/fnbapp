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
    expect(submitOrderSource).toContain("requestToken?: string");
    expect(submitOrderSource).toContain("clientRequestId: requestToken");
  });

  it("splits a semi-product shortfall into an implicit production step instead of debiting raw ingredients as a sale", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const ledgerSource = source.slice(source.indexOf("function buildStockLedgerEntries"));

    expect(source).toContain("splitImplicitProduction");
    expect(source).toContain("implicitYields");
    expect(ledgerSource).toContain('"PRODUCTION_CONSUME"');
    expect(ledgerSource).toContain('"PRODUCTION_YIELD"');
  });

  it("reuses a checkout token until the same payload succeeds", () => {
    const screenSource = readFileSync(
      resolve(process.cwd(), "components/POSScreen.tsx"),
      "utf8",
    );

    expect(screenSource).toContain("resolvePosCheckoutAttempt");
    expect(screenSource).toContain("checkoutAttemptRef");
    expect(screenSource).toMatch(
      /submitOrderV2\(\s*cartInput,\s*checkoutAttempt\.requestToken,?\s*\)/,
    );
    expect(screenSource).toContain("checkoutAttemptRef.current = null");
  });

  it("scopes the best-seller order-lines fetch to the requested date range instead of the whole table", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const bestSellerSource = source.slice(
      source.indexOf("export async function getPOSBestSellerProductIds"),
      source.indexOf("const loadPOSStockStatus"),
    );

    // Regression: this used to call findAllNoCache("Order_Lines_V2")
    // unconditionally -- an uncached full-table fetch (2,300+ rows and
    // growing, measured at 1.5s+ alone) on every POS page load, made worse
    // by revalidatePath("/pos") forcing this to run fresh after every
    // checkout. Must be date-scoped via findAllWhere whenever a date range
    // is available (the only real caller, app/pos/page.tsx, always passes
    // one).
    expect(bestSellerSource).toContain('findAllWhere("Order_Lines_V2"');
    expect(bestSellerSource).toMatch(
      /dateRange\s*\?\s*findAllWhere\("Order_Lines_V2"/,
    );
  });

  it("uses narrow POS reads instead of full admin reports", () => {
    const pageSource = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

    expect(pageSource).toContain("getPOSBestSellerProductIds");
    expect(pageSource).toContain("getPOSStockStatus");
    expect(pageSource).not.toContain("getSalesDataV2");
    expect(pageSource).not.toContain("getRealtimeStock");
  });
});
