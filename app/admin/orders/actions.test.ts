import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin order edit COGS calculation", () => {
  // Plan C Task 3: editing an order no longer computes a cost for the
  // replacement lines. The two tests that used to live here asserted the
  // removed machinery was present (MAC-vs-FIFO cost algorithm, the implicit-
  // production split for the new version's consumeEntries) -- replaced with
  // the opposite assertion, since "editing stops computing a new cost" is
  // exactly the regression worth locking in now. The reversal of the OLD
  // version's real ledger rows is unchanged -- see "reverses the complete
  // original checkout effect on edit" below, which still passes untouched.
  //
  // Phase C:
  // this test used to assert `consumeEntries: []` was still being sent --
  // Phase C removed supersede_order_v2_atomic's stock_ledger write
  // entirely, so there is no longer a consumeEntries field to send at all.
  it("computes no cost for the edited lines and writes no new consumption", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(source).not.toContain("computeMacCostForConsumptionRows");
    expect(source).not.toContain("allocateRecipeConsumption");
    expect(source).not.toContain("splitImplicitProduction");
    expect(source).not.toContain("buildLineConsumptionRows");
    expect(editOrderSource).not.toContain("FIFOTracker");
    expect(editOrderSource).not.toContain("consumeEntries");
  });

  it("preserves payment rows through the atomic edit transaction", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(editOrderSource).toContain('findAllWhere<{');
    expect(editOrderSource).toContain('>("Order_Payments"');
    expect(editOrderSource).toContain("planEditedOrderPayments(");
    expect(editOrderSource).toContain("payments: editedPayments");
  });

  it("bounds edit reads to the target order, and reads no ledger table at all", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(editOrderSource).toContain('findById("Orders_V2", input.orderId)');
    expect(editOrderSource).toContain('findAllWhere("Order_Lines_V2"');
    expect(editOrderSource).not.toContain('findAllNoCache("Orders_V2")');
    expect(editOrderSource).not.toContain('findAllNoCache("Order_Lines_V2")');
    // Phase A:
    // editOrderV2 no longer reads Stock_Ledger through any call shape --
    // proved live before removal that it always returned zero rows anyway
    // (53 real voided/edited order ids checked, 0 stock_ledger rows).
    expect(editOrderSource).not.toContain("Stock_Ledger");
    // The cost-time ledger-history read (findLedgerHistoryForItems, bounded
    // by lte: created_at / in: item_reference) is gone entirely, not merely
    // narrowed -- there is no cost left to compute it for.
    expect(source).not.toContain("findLedgerHistoryForItems");
    expect(source).not.toContain("in: { item_reference: batch }");
  });

  // Phase A
  // replaces this test's own prior claim. It used to assert editOrderV2
  // called buildVoidReversalRows to reverse the old order's real ledger
  // rows (same gap voidOrderV2 fixed before commit 4f6ba40: reversing only
  // SALES_CONSUME would lose the PRODUCTION_CONSUME/YIELD pair). That
  // machinery is gone -- proved live first that it was reversing nothing:
  // stock_ledger has carried zero sales-driven rows since the 2026-08-07
  // cutover, confirmed for every real voided/edited order in production
  // before this code was deleted, not assumed from that fact alone.
  //
  // Phase C:
  // this test used to assert `const reversalEntries: never[] = [];` was
  // still constructed -- Phase C removed supersede_order_v2_atomic's
  // stock_ledger write entirely, so there is no longer a reversalEntries
  // field to construct or send at all.
  it("no longer builds a reversal from ledger data -- there is no reversalEntries field left to send", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(
      source.indexOf("export async function editOrderV2"),
      source.indexOf("export async function", source.indexOf("export async function editOrderV2") + 1),
    );

    expect(source).not.toContain("buildVoidReversalRows");
    expect(source).not.toContain("void-order-reversal");
    expect(editOrderSource).not.toContain("reversalEntries");
  });
});

// getOrdersV2 was not in the plan's own list -- found while re-deriving it.
// Source-grep, matching this file's own convention for actions.ts (the
// function builds a raw Supabase query-builder chain, not the findAll/
// findAllWhere shape the rest of this sweep's execution-level tests mock).
describe("getOrdersV2 -- not in the plan's own list, found while re-deriving it", () => {
  it("rethrows on failure instead of returning a fabricated empty page", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const getOrdersSource = source.slice(
      source.indexOf("export async function getOrdersV2"),
      source.indexOf("export async function getOrderDetailV2"),
    );

    expect(getOrdersSource).toContain("} catch (err: any) {");
    expect(getOrdersSource).toContain("throw err;");
    expect(getOrdersSource).not.toContain("return { orders: [], totalCount: 0");
  });
});
