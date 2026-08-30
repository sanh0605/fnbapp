import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("POS order COGS calculation", () => {
  // Plan C Task 3: checkout no longer computes a cost or moves stock. The
  // two tests that used to live here asserted the removed machinery was
  // present (getPosInventoryState, computeMacCostFromUnitCosts,
  // buildStockLedgerEntries, the implicit-production split) -- replaced with
  // the opposite assertion rather than deleted silently, since "checkout
  // stops doing the work" is exactly the regression worth locking in now.
  //
  // docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md Phase C
  // (8/8, POS): this test used to assert `ledgerRows: []` was still being
  // sent -- Phase C removed create_pos_order_atomic's stock_ledger write
  // entirely, so there is no longer a ledgerRows field to send at all.
  it("computes no cost and writes no ledger row -- one atomic write with no ledger field", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const submitOrderSource = source.slice(
      source.indexOf("export async function submitOrderV2"),
      source.indexOf("export async function getPOSBestSellerProductIds"),
    );

    expect(source).not.toContain("getPosInventoryState");
    expect(source).not.toContain("computeMacCostFromUnitCosts");
    expect(source).not.toContain("buildStockLedgerEntries");
    expect(source).not.toContain("splitImplicitProduction");
    expect(source).toContain("savePosOrderAtomic");
    expect(submitOrderSource).not.toContain("ledgerRows");
    expect(submitOrderSource).not.toContain('findAllNoCache("Stock_Ledger")');
    expect(submitOrderSource).not.toContain("assignOrderNo");
    expect(submitOrderSource).not.toContain("ensureUniqueOrderNo");
    expect(submitOrderSource).not.toContain("insertOrderV2Records");
    expect(submitOrderSource).not.toContain("FIFOTracker");
    expect(submitOrderSource).toContain("requestToken?: string");
    expect(submitOrderSource).toContain("clientRequestId: requestToken");
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
      source.indexOf("export async function getPOSDrafts"),
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

  // docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md Phase A:
  // getPOSStockStatus is gone from the module entirely now (owner decision
  // 2026-08-31, see app/pos/actions.auth.test.ts's "no longer exports"
  // proof), not merely uncalled -- the not.toContain check below is on the
  // CALL shape, not the bare name, since the page's own comment names the
  // deleted function on purpose, explaining why it is gone.
  it("does not fetch stock or recipes -- the out-of-stock feature stays disabled, and its data function is gone", () => {
    const pageSource = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

    expect(pageSource).toContain("getPOSBestSellerProductIds");
    expect(pageSource).not.toContain("getPOSStockStatus()");
    expect(pageSource).not.toContain('findAll("Recipes")');
    expect(pageSource).not.toContain("pickVariantRecipe");
    expect(pageSource).not.toContain("outOfStockProductIds=");
    expect(pageSource).not.toContain("getSalesDataV2");
    expect(pageSource).not.toContain("getRealtimeStock");
  });
});
