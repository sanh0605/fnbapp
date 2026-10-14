import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit C12 (2026-10-14): list and detail carry `payments`, the order's
// effective payment rows, so the screens can show a split order part by part.

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  orders: [] as any[],
  payments: [] as any[],
  findAllWhereInBatches: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockResolvedValue([]),
  findAllWhere: vi.fn().mockResolvedValue([]),
  findAllWhereInBatches: mocks.findAllWhereInBatches,
  findById: mocks.findById,
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sales/void-order-transaction", () => ({ voidOrderAtomic: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => ({ from: () => makeQuery() }),
}));

function makeQuery() {
  const q: any = {
    select: () => q, eq: () => q, neq: () => q, gte: () => q, lte: () => q, ilike: () => q,
    or: () => q, order: () => q, range: () => q,
    then: (resolve: any) => resolve({ data: mocks.orders, count: mocks.orders.length, error: null }),
  };
  return q;
}

import { getOrdersV2 } from "./actions";
import { getOrderDetailV2 } from "./order-detail-actions";

const order = (id: string, over: Record<string, any> = {}) => ({
  id, order_no: `#${id}`, brand_id: "BR-1", status: "COMPLETED", version: 1, parent_order_id: "",
  superseded_by: "", payment_method: "CASH", net_total: 18000, created_at: "2026-10-06T05:00:00Z", ...over,
});

describe("order payments field (C12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { name: "admin", role: "ADMIN" } });
    mocks.orders = [order("split"), order("plain", { payment_method: "BANK_TRANSFER", net_total: 5000 })];
    mocks.payments = [
      { order_id: "split", method: "CASH", amount: 9000 },
      { order_id: "split", method: "BANK_TRANSFER", amount: 9000 },
    ];
    mocks.findAllWhereInBatches.mockImplementation(async (sheet: string, _col: string, ids: string[]) =>
      sheet === "Order_Payments" ? mocks.payments.filter(p => ids.includes(p.order_id)) : []);
    mocks.findById.mockImplementation(async (_s: string, id: string) => mocks.orders.find(o => o.id === id) ?? null);
  });

  it("list: two rows for a split order, one fallback row for an order without rows", async () => {
    const r = await getOrdersV2({});
    const byId = Object.fromEntries(r.orders.map(o => [o.id, o.payments]));
    expect(byId.split).toEqual([{ method: "CASH", amount: 9000 }, { method: "BANK_TRANSFER", amount: 9000 }]);
    expect(byId.plain).toEqual([{ method: "BANK_TRANSFER", amount: 5000 }]);
    // one payments read for the whole page
    expect(mocks.findAllWhereInBatches).toHaveBeenCalledWith("Order_Payments", "order_id", ["split", "plain"]);
  });

  it("list: no orders asks for no payment ids (the batch helper then runs no query)", async () => {
    mocks.orders = [];
    expect((await getOrdersV2({})).orders).toEqual([]);
    expect(mocks.findAllWhereInBatches).toHaveBeenCalledWith("Order_Payments", "order_id", []);
  });

  it("detail: two rows for a split order, one fallback row otherwise", async () => {
    const split = await getOrderDetailV2("split");
    expect(split?.order.payments).toEqual([{ method: "CASH", amount: 9000 }, { method: "BANK_TRANSFER", amount: 9000 }]);
    const plain = await getOrderDetailV2("plain");
    expect(plain?.order.payments).toEqual([{ method: "BANK_TRANSFER", amount: 5000 }]);
  });
});
