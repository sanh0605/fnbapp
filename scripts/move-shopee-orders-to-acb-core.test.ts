import { describe, expect, it } from "vitest";
import { pickAcbAccount, planMove, withMove, type PurchaseOrderRow } from "./move-shopee-orders-to-acb-core";

const po = (over: Partial<PurchaseOrderRow> & Pick<PurchaseOrderRow, "id">): PurchaseOrderRow => ({
  status: "COMPLETED", source_id: "SRC-001", payment_method: "CASH", bank_account_id: null,
  total_amount: 1000, transaction_date: "2026-09-30T03:00:00+00:00", created_at: "2026-09-30T03:00:00+00:00",
  ...over,
});

describe("planMove", () => {
  it("takes only completed cash orders from the Shopee source, and sums them", () => {
    const orders = [
      po({ id: "PO-195", total_amount: 2_443_400 }),
      po({ id: "PO-001", total_amount: 100 }),
      po({ id: "PO-010", source_id: "SRC-002" }), // Lazada
      po({ id: "PO-011", payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" }), // already bank
      po({ id: "PO-012", status: "CANCELLED", payment_method: "CASH" }),
      po({ id: "PO-013", status: "DRAFT", payment_method: null }),
    ];
    const plan = planMove(orders, "SRC-001");
    expect(plan.targets.map((t) => t.id)).toEqual(["PO-001", "PO-195"]);
    expect(plan.total).toBe(2_443_500);
  });
});

describe("withMove", () => {
  it("moves exactly the planned orders to the bank account and leaves the rest and the input alone", () => {
    const orders = [po({ id: "PO-1" }), po({ id: "PO-2", source_id: "SRC-002" })];
    const moved = withMove(orders, ["PO-1"], "BA-001");
    expect(moved[0]).toMatchObject({ payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" });
    expect(moved[1]).toMatchObject({ payment_method: "CASH", bank_account_id: null });
    expect(orders[0].payment_method).toBe("CASH");
  });
});

describe("pickAcbAccount", () => {
  it("returns the one active account named ACB", () => {
    expect(pickAcbAccount([
      { id: "BA-001", name: "ACB - Phin Di", status: "ACTIVE" },
      { id: "BA-002", name: "ACB cũ", status: "INACTIVE" },
      { id: "BA-003", name: "Vietcombank", status: "ACTIVE" },
    ])).toBe("BA-001");
  });

  it("refuses to guess when there is none or more than one", () => {
    expect(() => pickAcbAccount([{ id: "BA-003", name: "Vietcombank", status: "ACTIVE" }])).toThrow("ACB");
    expect(() => pickAcbAccount([
      { id: "BA-001", name: "ACB 1", status: "ACTIVE" },
      { id: "BA-002", name: "ACB 2", status: "ACTIVE" },
    ])).toThrow("ACB");
  });
});
