import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAllWhere: vi.fn(),
  build: vi.fn(),
  supersede: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ ok: true, actor: { id: "u1", name: "Admin" } }),
}));
vi.mock("@/lib/db/tables", () => ({
  findById: vi.fn().mockResolvedValue({ id: "ord-1" }),
  findAllWhere: mocks.findAllWhere,
  findAll: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./order-helpers", () => ({
  normalizeOrderV2: () => ({ id: "ord-1", version: 1, net_total: 18000 }),
  normalizeLineV2: (l: unknown) => l,
}));
vi.mock("@/lib/sales/sheets-db-v2-edit", () => ({ supersedeOrderV2: mocks.supersede }));
vi.mock("@/lib/sales/order-edit-cart", async (orig) => ({
  ...(await orig<typeof import("@/lib/sales/order-edit-cart")>()),
  buildEditedOrderFromCart: mocks.build,
}));

import { editOrderV2 } from "./order-edit-actions";

const OLD_ROWS = [
  { method: "CASH", amount: 9000, reference: "" },
  { method: "BANK_TRANSFER", amount: 9000, reference: "" },
];

function run(payments: unknown, netTotal = 18000) {
  mocks.findAllWhere.mockImplementation(async (t: string) => (t === "Order_Payments" ? OLD_ROWS : []));
  mocks.build.mockReturnValue({
    order: { id: "ord-2", version: 2, net_total: netTotal, gross_total: netTotal, payment_method: "CASH" },
    lines: [],
  });
  mocks.supersede.mockResolvedValue({ success: true });
  return editOrderV2({
    orderId: "ord-1", expectedVersion: 1, reason: "x",
    cart: { payment_method: "CASH", payments } as never,
  });
}

const saved = () =>
  mocks.supersede.mock.calls[0][0].payments.map((p: { method: string; amount: number }) => [p.method, p.amount]);

describe("editOrderV2 payment parts (BR-SALE-013)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the parts sent, and keeps them out of the cart math", async () => {
    const res = await run([
      { method: "CASH", amount: 10000, reference: "" },
      { method: "BANK_TRANSFER", amount: 8000, reference: "TX" },
    ]);
    expect(res.success).toBe(true);
    expect(mocks.build.mock.calls[0][0].payments).toBeUndefined();
    expect(mocks.build.mock.calls[0][0].payment_method).toBe("CASH");
    expect(saved()).toEqual([["CASH", 10000], ["BANK_TRANSFER", 8000]]);
  });

  it("one part takes the server's total even when its own amount is stale", async () => {
    await run([{ method: "BANK_TRANSFER", amount: 1, reference: "" }]);
    expect(mocks.build.mock.calls[0][0].payment_method).toBe("BANK_TRANSFER");
    expect(saved()).toEqual([["BANK_TRANSFER", 18000]]);
  });

  it("refuses parts that miss the total and writes nothing", async () => {
    const res = await run([
      { method: "CASH", amount: 9000, reference: "" },
      { method: "BANK_TRANSFER", amount: 8000, reference: "" },
    ]);
    expect(res).toEqual({
      success: false,
      error: "Tổng các phần thanh toán (17.000đ) phải bằng tiền đơn (18.000đ).",
    });
    expect(mocks.supersede).not.toHaveBeenCalled();
  });
});
