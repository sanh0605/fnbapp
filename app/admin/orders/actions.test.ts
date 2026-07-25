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

  it("preserves payment rows through the atomic edit transaction", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(editOrderSource).toContain('findAllWhere<{');
    expect(editOrderSource).toContain('>("Order_Payments"');
    expect(editOrderSource).toContain("planEditedOrderPayments(");
    expect(editOrderSource).toContain("payments: editedPayments");
  });

  it("bounds edit reads to the target order and ledger history through its sale time", () => {
    const source = readFileSync(resolve(__dirname, "actions.ts"), "utf8");
    const editOrderSource = source.slice(source.indexOf("export async function editOrderV2"));

    expect(editOrderSource).toContain('findById("Orders_V2", input.orderId)');
    expect(editOrderSource).toContain('findAllWhere("Order_Lines_V2"');
    expect(editOrderSource).toContain('lte: { created_at: originalSaleTime }');
    expect(editOrderSource).toContain('in: { item_reference: batch }');
    expect(editOrderSource).toContain('eq: { reference_id: oldOrderV2.id }');
    expect(editOrderSource).not.toContain('findAllNoCache("Orders_V2")');
    expect(editOrderSource).not.toContain('findAllNoCache("Order_Lines_V2")');
    expect(editOrderSource).not.toContain('findAllNoCache("Stock_Ledger")');
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
