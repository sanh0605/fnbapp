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
  it("computes no cost for the edited lines and writes no new consumption", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(source).not.toContain("computeMacCostForConsumptionRows");
    expect(source).not.toContain("allocateRecipeConsumption");
    expect(source).not.toContain("splitImplicitProduction");
    expect(source).not.toContain("buildLineConsumptionRows");
    expect(editOrderSource).not.toContain("FIFOTracker");
    expect(editOrderSource).toContain("consumeEntries: []");
  });

  it("preserves payment rows through the atomic edit transaction", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(editOrderSource).toContain('findAllWhere<{');
    expect(editOrderSource).toContain('>("Order_Payments"');
    expect(editOrderSource).toContain("planEditedOrderPayments(");
    expect(editOrderSource).toContain("payments: editedPayments");
  });

  it("bounds edit reads to the target order, and no longer reads ledger history for cost", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(editOrderSource).toContain('findById("Orders_V2", input.orderId)');
    expect(editOrderSource).toContain('findAllWhere("Order_Lines_V2"');
    // Still reads the old version's own ledger rows, to reverse them.
    expect(editOrderSource).toContain('eq: { reference_id: oldOrderV2.id }');
    expect(editOrderSource).not.toContain('findAllNoCache("Orders_V2")');
    expect(editOrderSource).not.toContain('findAllNoCache("Order_Lines_V2")');
    expect(editOrderSource).not.toContain('findAllNoCache("Stock_Ledger")');
    // The cost-time ledger-history read (findLedgerHistoryForItems, bounded
    // by lte: created_at / in: item_reference) is gone entirely, not merely
    // narrowed -- there is no cost left to compute it for.
    expect(source).not.toContain("findLedgerHistoryForItems");
    expect(source).not.toContain("in: { item_reference: batch }");
  });

  it("reverses the complete original checkout effect on edit, including implicit production, same as void", () => {
    // Same underlying gap voidOrderV2 had before commit 4f6ba40: reversing
    // only SALES_CONSUME on edit would permanently lose the raw-ingredient
    // PRODUCTION_CONSUME deduction and double-count the PRODUCTION_YIELD
    // semi-product gain whenever the original sale triggered implicit
    // production. editOrderV2 must reuse the same buildVoidReversalRows
    // helper voidOrderV2 uses (already unit-tested in
    // lib/void-order-reversal.test.ts for the PRODUCTION_CONSUME/YIELD case),
    // not a bespoke SALES_CONSUME-only filter.
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(
      source.indexOf("export async function editOrderV2"),
      source.indexOf("// 8. Build new SALES_CONSUME entries"),
    );

    expect(editOrderSource).toContain("buildVoidReversalRows({");
    expect(editOrderSource).toContain("ledgerRows: oldOrderLedger");
    expect(editOrderSource).not.toContain('transaction_type === "SALES_CONSUME"');
  });
});

// docs/superpowers/plans/2026-08-27-stop-reporting-failures-as-empty.md:
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
