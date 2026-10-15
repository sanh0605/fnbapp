import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  orders: [
    { id: "o1", version: 1, parent_order_id: "", promo_discount_total: 25100 },
  ] as any[],
  promotions: [
    { order_id: "o1", promotion_id: "B", seq: 2, name: "KHAITRUONG", amount: 5100 },
    { order_id: "o1", promotion_id: "A", seq: 1, name: "GIẢM 10K", amount: 20000 },
  ],
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockResolvedValue([]),
  findAllWhereInBatches: async (table: string, _col: string, ids: string[]) =>
    table === "Order_Promotions" ? db.promotions.filter((p) => ids.includes(p.order_id)) : [],
  findById: async (_t: string, id: string) => db.orders.find((r) => r.id === id) ?? null,
  findAllWhere: vi.fn().mockResolvedValue([]),
}));

import { getOrderDetailV2 } from "./order-detail-actions";

describe("order detail lists the promotions applied", () => {
  it("reads order_promotions in the order they were applied", async () => {
    const res = await getOrderDetailV2("o1");
    expect(res?.promotions.map((p) => [p.name, p.amount])).toEqual([["GIẢM 10K", 20000], ["KHAITRUONG", 5100]]);
  });
});
