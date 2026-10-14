import { describe, expect, it } from "vitest";
import { coerceLineV2 } from "@/lib/sales/order-types";
import { normalizeLineV2 } from "@/app/admin/orders/order-helpers";

// order_lines_v2.cost_at_sale is dropped by migration 0121: a read model must not invent it.
describe("order line readers stop reading cost_at_sale", () => {
  const row = { id: "ol-1", line_no: "1", qty: "2", unit_price: "20000" };

  it("coerceLineV2 coerces the money fields and adds no cost_at_sale", () => {
    const line = coerceLineV2(row);
    expect(line.qty).toBe(2);
    expect(line).not.toHaveProperty("cost_at_sale");
  });

  it("normalizeLineV2 coerces the money fields and adds no cost_at_sale", () => {
    const line = normalizeLineV2(row);
    expect(line.unit_price).toBe(20000);
    expect(line).not.toHaveProperty("cost_at_sale");
  });
});
