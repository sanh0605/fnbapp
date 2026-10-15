import { describe, expect, it } from "vitest";
import { replayOrders } from "./verify-price-cart-core";

const snapshot = JSON.stringify({
  id: "PRM-004",
  type: "PRODUCT_DISCOUNT",
  discount_type: "FLAT_VND",
  discount_value: 10000,
  applicable_products_json: JSON.stringify(["TRA-DAU", "TRA-XOAI"]),
  code: "",
});

const line = (order_id: string, line_no: number, variant_id: string, net: number) => ({
  order_id,
  line_no,
  variant_id,
  qty: 1,
  unit_price: 27000,
  modifiers_snapshot_json: "[]",
  promo_discount: 10000,
  manual_item_discount: 0,
  order_discount_allocation: 0,
  net_line_total: net,
});

describe("replayOrders", () => {
  it("counts a matching order as 0 differences and a wrong stored net as one", () => {
    const orders = [
      { id: "o1", order_no: "260714002013", manual_order_discount: 0, applied_promotion_snapshot_json: snapshot },
      { id: "o2", order_no: "260714002014", manual_order_discount: 0, applied_promotion_snapshot_json: snapshot },
    ];
    const lines = [
      line("o1", 1, "TRA-DAU", 17000),
      line("o1", 2, "TRA-XOAI", 17000),
      line("o2", 1, "TRA-DAU", 17000),
      line("o2", 2, "TRA-XOAI", 16000),
    ];
    const r = replayOrders(orders, lines);
    expect(r.lineCount).toBe(4);
    expect(r.badLines).toBe(1);
    expect(r.orderNos).toEqual(["260714002014"]);
    expect(r.diffs).toEqual([{ order_no: "260714002014", line_no: 2, field: "net_line_total", stored: 16000, computed: 17000 }]);
  });
});
