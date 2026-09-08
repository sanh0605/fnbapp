import { describe, expect, it } from "vitest";
import {
  checkPurchaseOrderReconciliation,
  buildChallengerPurchases,
  buildChallengerIssues,
  computeWeightedAverageIssuedValue,
  splitIssuedValueBySource,
  type PurchaseOrderHeader,
  type PurchaseOrderLineRow,
} from "./verify-cogs-core";

// docs/superpowers/plans/2026-09-07-verify-cogs.md Task 1 Step 1.

describe("checkPurchaseOrderReconciliation (Gate 1)", () => {
  it("an order that reconciles: 0 mismatches", () => {
    const orders: PurchaseOrderHeader[] = [
      { id: "PO-1", subtotal_amount: 100_000, shipping_fee: 10_000, tax_amount: 0, voucher_amount: 5_000, discount_amount: 0, total_amount: 105_000 },
    ];
    const lines: PurchaseOrderLineRow[] = [{ purchase_order_id: "PO-1", subtotal: 100_000 }];

    const result = checkPurchaseOrderReconciliation(orders, lines);

    expect(result.reconciliationMismatches).toEqual([]);
    expect(result.subtotalMismatches).toEqual([]);
    expect(result.ordersWithNoLines).toEqual([]);
    expect(result.orderCount).toBe(1);
    expect(result.lineCount).toBe(1);
  });

  it("an order off by the shipping fee is caught", () => {
    // total_amount omits shipping_fee entirely -- a real way this could go wrong.
    const orders: PurchaseOrderHeader[] = [
      { id: "PO-2", subtotal_amount: 100_000, shipping_fee: 10_000, tax_amount: 0, voucher_amount: 0, discount_amount: 0, total_amount: 100_000 },
    ];
    const lines: PurchaseOrderLineRow[] = [{ purchase_order_id: "PO-2", subtotal: 100_000 }];

    const result = checkPurchaseOrderReconciliation(orders, lines);

    expect(result.reconciliationMismatches).toEqual([
      { order_id: "PO-2", lineSubtotalSum: 100_000, reconciled: 110_000, total_amount: 100_000 },
    ]);
  });

  it("an order with no lines is reported, not silently skipped from the sum", () => {
    const orders: PurchaseOrderHeader[] = [
      { id: "PO-3", subtotal_amount: 0, shipping_fee: 0, tax_amount: 0, voucher_amount: 0, discount_amount: 0, total_amount: 0 },
    ];
    const lines: PurchaseOrderLineRow[] = [];

    const result = checkPurchaseOrderReconciliation(orders, lines);

    expect(result.ordersWithNoLines).toEqual(["PO-3"]);
    expect(result.reconciliationMismatches).toEqual([]);
  });
});

describe("buildChallengerPurchases / buildChallengerIssues (Gate 2 inputs)", () => {
  it("allocates shipping onto the one line of a single-line COMPLETED order", () => {
    const orders = [{ id: "PO-1", status: "COMPLETED", subtotal_amount: 100_000, shipping_fee: 10_000, tax_amount: 0, voucher_amount: 0, discount_amount: 0, total_amount: 110_000, transaction_date: "2026-01-01", created_at: "2026-01-01" }];
    const lines = [{ id: "POL-1", purchase_order_id: "PO-1", purchased_item_id: "NNL-001", base_quantity: 10, subtotal: 100_000 }];

    const purchases = buildChallengerPurchases(orders, lines);

    expect(purchases).toEqual([{ purchased_item_id: "NNL-001", at: "2026-01-01", base_quantity: 10, subtotal: 110_000 }]);
  });

  it("excludes a non-COMPLETED order's lines entirely", () => {
    const orders = [{ id: "PO-2", status: "DRAFT", subtotal_amount: 50_000, shipping_fee: 0, tax_amount: 0, voucher_amount: 0, discount_amount: 0, total_amount: 50_000, transaction_date: "2026-01-01", created_at: "2026-01-01" }];
    const lines = [{ id: "POL-2", purchase_order_id: "PO-2", purchased_item_id: "NNL-001", base_quantity: 5, subtotal: 50_000 }];

    expect(buildChallengerPurchases(orders, lines)).toEqual([]);
  });

  it("excludes an equipment item's issue", () => {
    const issues = [
      { purchased_item_id: "EQ-001", issued_at: "2026-01-05", base_quantity: 1, source: "MANUAL" as const },
      { purchased_item_id: "NNL-001", issued_at: "2026-01-05", base_quantity: 2, source: "MANUAL" as const },
    ];
    const purchasedItems = [{ id: "EQ-001", item_category_id: "CAT-EQ" }, { id: "NNL-001", item_category_id: "CAT-RAW" }];
    const itemCategories = [{ id: "CAT-EQ", system_type: "EQUIPMENT" }, { id: "CAT-RAW", system_type: "RAW" }];

    const result = buildChallengerIssues(issues, purchasedItems, itemCategories);

    expect(result).toEqual([{ purchased_item_id: "NNL-001", at: "2026-01-05", base_quantity: 2, source: "MANUAL" }]);
  });
});

describe("computeWeightedAverageIssuedValue (Gate 2 core)", () => {
  it("values an issue at the weighted average across two purchases at different prices", () => {
    const purchases = [
      { purchased_item_id: "NNL-001", at: "2026-01-01", base_quantity: 10, subtotal: 100_000 }, // 10.000/unit
      { purchased_item_id: "NNL-001", at: "2026-01-02", base_quantity: 10, subtotal: 200_000 }, // 20.000/unit
    ];
    // Pool after both purchases: 20 units, 300.000d -> average 15.000/unit.
    const issues = [{ purchased_item_id: "NNL-001", at: "2026-01-03", base_quantity: 5, source: "MANUAL" as const }];

    const result = computeWeightedAverageIssuedValue(purchases, issues);

    expect(result.total).toBe(75_000); // 5 * 15.000
    expect(result.byItem).toEqual([{ purchased_item_id: "NNL-001", issued_value: 75_000 }]);
  });

  it("throws rather than silently pricing an issue that has no purchase behind it -- a data integrity problem, not a number to report", () => {
    const result = () => computeWeightedAverageIssuedValue([], [
      { purchased_item_id: "NNL-001", at: "2026-01-02", base_quantity: 5, source: "MANUAL" as const },
    ]);

    expect(result).toThrow(/issue precedes any purchase/);
  });

  it("throws rather than silently pricing an issue larger than what is on hand", () => {
    const purchases = [{ purchased_item_id: "NNL-001", at: "2026-01-01", base_quantity: 5, subtotal: 50_000 }];
    const result = () => computeWeightedAverageIssuedValue(purchases, [
      { purchased_item_id: "NNL-001", at: "2026-01-02", base_quantity: 10, source: "MANUAL" as const },
    ]);

    expect(result).toThrow(/issue exceeds quantity on hand/);
  });

  it("a STOCKTAKE issue is valued the same as a MANUAL one in the combined total (Gate 2 matches getPnLDataV2, which does not filter by source)", () => {
    const purchases = [{ purchased_item_id: "NNL-001", at: "2026-01-01", base_quantity: 10, subtotal: 100_000 }];
    const manual = computeWeightedAverageIssuedValue(purchases, [
      { purchased_item_id: "NNL-001", at: "2026-01-02", base_quantity: 5, source: "MANUAL" as const },
    ]);
    const stocktake = computeWeightedAverageIssuedValue(purchases, [
      { purchased_item_id: "NNL-001", at: "2026-01-02", base_quantity: 5, source: "STOCKTAKE" as const },
    ]);

    expect(stocktake.total).toBe(manual.total);
  });
});

describe("splitIssuedValueBySource (the BR-COGS-007 gap the script must surface)", () => {
  it("a STOCKTAKE issue lands in the shrinkage figure, separate from the MANUAL figure, though both sum into Gate 2's total", () => {
    const purchases = [{ purchased_item_id: "NNL-001", at: "2026-01-01", base_quantity: 20, subtotal: 200_000 }]; // 10.000/unit
    const issues = [
      { purchased_item_id: "NNL-001", at: "2026-01-02", base_quantity: 3, source: "MANUAL" as const },
      { purchased_item_id: "NNL-001", at: "2026-01-03", base_quantity: 2, source: "STOCKTAKE" as const },
    ];

    const { byEvent, total } = computeWeightedAverageIssuedValue(purchases, issues);
    const split = splitIssuedValueBySource(issues, byEvent);

    expect(split.manualCount).toBe(1);
    expect(split.stocktakeCount).toBe(1);
    expect(split.manualValue).toBe(30_000); // 3 * 10.000
    expect(split.stocktakeValue).toBe(20_000); // 2 * 10.000
    expect(split.totalValue).toBe(total); // the split accounts for the whole reconciled total, nothing dropped
  });
});
