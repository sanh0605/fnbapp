import { describe, expect, it } from "vitest";

import { sumCompletedProductionYieldBySemiProduct } from "./production-stock-audit";

describe("sumCompletedProductionYieldBySemiProduct", () => {
  it("uses canonical completed production order batch yields only", () => {
    const result = sumCompletedProductionYieldBySemiProduct([
      { semi_product_id: "BTP-001", batch_yield: "100", status: "COMPLETED" },
      { semi_product_id: "BTP-001", batch_yield: 20, status: "COMPLETED" },
      { semi_product_id: "BTP-001", batch_yield: 500, status: "PENDING" },
      { semi_product_id: "BTP-002", batch_yield: 40, status: "CANCELLED" },
    ]);

    expect(result).toEqual(new Map([
      ["BTP-001", 120],
    ]));
  });
});
