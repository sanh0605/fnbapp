import { describe, it, expect } from "vitest";
import { planPaymentRow } from "./add-missing-order-payment-core";

const order = { id: "ord-1", order_no: "260723001017", status: "COMPLETED", payment_method: "CASH", net_total: 25000, created_at: "2026-07-22T18:11:37.189+00:00" };

describe("planPaymentRow", () => {
  it("builds one row that pays the whole net total by the order's own method", () => {
    expect(planPaymentRow(order, [])).toEqual({
      id: "pay-ord-1", order_id: "ord-1", method: "CASH", amount: 25000, reference: "", created_at: order.created_at,
    });
  });

  it("refuses an order that already has a payment row", () => {
    expect(() => planPaymentRow(order, [{ order_id: "ord-1" }])).toThrow(/already has/);
  });

  it("refuses an order that is not COMPLETED", () => {
    expect(() => planPaymentRow({ ...order, status: "SUPERSEDED" }, [])).toThrow(/COMPLETED/);
  });
});
