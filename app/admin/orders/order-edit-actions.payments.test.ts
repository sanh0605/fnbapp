import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findAllWhere: vi.fn(),
  findAll: vi.fn(),
  supersede: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ ok: true, actor: { id: "u1", name: "Admin" } }),
}));
vi.mock("@/lib/db/tables", () => ({
  findById: mocks.findById,
  findAllWhere: mocks.findAllWhere,
  findAll: mocks.findAll,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sales/sheets-db-v2-edit", () => ({ supersedeOrderV2: mocks.supersede }));

import { changeOrderPayments } from "./order-edit-actions";

// Shape of order 260717002011: sold by tuyen2612, 59,000, paid in cash.
const OLD_ORDER = {
  id: "ord-1", order_no: "260717002011", brand_id: "BR-002", outlet_id: "OUT-1",
  status: "COMPLETED", version: "2", parent_order_id: "ord-0",
  created_at: "2026-07-17T02:00:00Z", completed_at: "2026-07-17T02:01:00Z",
  created_by_id: "u-tuyen", created_by_name: "tuyen2612",
  gross_total: "59000", promo_discount_total: "0", manual_item_discount_total: "0",
  manual_order_discount: "0", net_total: "59000",
  applied_promotion_id: "PRM-003", applied_promotion_snapshot_json: { id: "PRM-003" },
  pos_snapshot_json: {}, payment_method: "CASH",
};
const OLD_LINES = [
  { id: "l-1", order_id: "ord-1", line_no: 1, product_id: "PAUSED-DISH", qty: 1, unit_price: 59000,
    gross_line_total: 59000, net_line_total: 59000, product_snapshot_json: { name: "Sữa dâu" } },
];

function run(over: Record<string, unknown> = {}) {
  mocks.findById.mockResolvedValue(OLD_ORDER);
  mocks.findAllWhere.mockImplementation(async (t: string) => (t === "Order_Lines_V2" ? OLD_LINES : [
    { method: "CASH", amount: 59000, reference: "" },
  ]));
  mocks.supersede.mockResolvedValue({ success: true });
  return changeOrderPayments({
    orderId: "ord-1", expectedVersion: 2, reason: "Khách chuyển khoản",
    payments: [{ method: "BANK_TRANSFER", amount: 1, reference: "TX" }],
    ...over,
  } as never);
}
const sent = () => mocks.supersede.mock.calls[0][0];

describe("changeOrderPayments (BR-SALE-014)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a payment switch keeps seller, promotion, lines and total", async () => {
    const res = await run();
    expect(res).toMatchObject({ success: true });
    const { newOrder, newLines, payments, event } = sent();
    expect(newOrder).toMatchObject({
      created_by_id: "u-tuyen", created_by_name: "tuyen2612", applied_promotion_id: "PRM-003",
      applied_promotion_snapshot_json: { id: "PRM-003" }, net_total: "59000", gross_total: "59000",
      outlet_id: "OUT-1", created_at: OLD_ORDER.created_at, order_no: "260717002011",
      version: 3, parent_order_id: "ord-1", payment_method: "BANK_TRANSFER",
    });
    expect(newOrder.id).not.toBe("ord-1");
    expect(newLines).toHaveLength(1);
    expect(newLines[0]).toMatchObject({ product_id: "PAUSED-DISH", unit_price: 59000, net_line_total: 59000, order_id: newOrder.id });
    expect(newLines[0].id).not.toBe("l-1");
    expect(payments.map((p: { method: string; amount: number }) => [p.method, p.amount])).toEqual([["BANK_TRANSFER", 59000]]);
    expect(event).toMatchObject({ actor_id: "u1", actor_name: "Admin", reason: "Khách chuyển khoản", from_version: 2, to_version: 3 });
    expect(JSON.parse(event.delta_json)).toEqual({
      old_payments: [{ method: "CASH", amount: 59000 }],
      new_payments: [{ method: "BANK_TRANSFER", amount: 59000 }],
    });
  });

  it("refuses two parts that miss the total and writes nothing", async () => {
    const res = await run({ payments: [
      { method: "CASH", amount: 30000 }, { method: "BANK_TRANSFER", amount: 20000 },
    ] });
    expect(res).toEqual({ success: false, error: "Tổng các phần thanh toán (50.000đ) phải bằng tiền đơn (59.000đ)." });
    expect(mocks.supersede).not.toHaveBeenCalled();
  });

  it("refuses an empty reason", async () => {
    expect(await run({ reason: "  " })).toEqual({ success: false, error: "Lý do chỉnh sửa là bắt buộc" });
    expect(mocks.supersede).not.toHaveBeenCalled();
  });

  it("maps a version clash to Vietnamese", async () => {
    mocks.supersede.mockResolvedValue({
      success: false,
      error: "supersede_order_v2_atomic: Optimistic lock failed: expected version 2 but found 3",
    });
    mocks.findById.mockResolvedValue(OLD_ORDER);
    mocks.findAllWhere.mockResolvedValue([]);
    const res = await changeOrderPayments({
      orderId: "ord-1", expectedVersion: 2, reason: "x", payments: [{ method: "CASH", amount: 1 }],
    });
    expect(res).toEqual({ success: false, error: "Đơn vừa được người khác sửa, tải lại trang rồi làm lại" });
  });

  it("says Vietnamese for a missing order", async () => {
    mocks.findById.mockResolvedValue(null);
    mocks.findAllWhere.mockResolvedValue([]);
    const res = await changeOrderPayments({
      orderId: "nope", expectedVersion: 1, reason: "x", payments: [{ method: "CASH", amount: 1 }],
    });
    expect(res).toEqual({ success: false, error: "Không tìm thấy đơn" });
  });

  it("an order holding a paused dish can still change payment, and the catalog is never read", async () => {
    const res = await run();
    expect(res).toMatchObject({ success: true });
    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});
