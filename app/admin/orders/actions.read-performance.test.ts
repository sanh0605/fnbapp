import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  findAllWhereInBatches: vi.fn(),
  findById: vi.fn(),
  voidOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
  findAllWhereInBatches: mocks.findAllWhereInBatches,
  findById: mocks.findById,
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/void-order-transaction", () => ({
  voidOrderAtomic: mocks.voidOrderAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { getOrderDetailV2 } from "./actions";

describe("getOrderDetailV2 query scope", () => {
  const rootOrder = {
    id: "ord-root",
    order_no: "UCK000001",
    brand_id: "BR-001",
    status: "SUPERSEDED",
    version: 1,
    parent_order_id: "",
    superseded_by: "ord-current",
    created_at: "2026-07-01T01:00:00.000Z",
    net_total: 20_000,
  };
  const currentOrder = {
    ...rootOrder,
    id: "ord-current",
    status: "COMPLETED",
    version: 2,
    parent_order_id: rootOrder.id,
    superseded_by: "",
    created_at: "2026-07-01T02:00:00.000Z",
    net_total: 25_000,
  };
  const currentLine = {
    id: "line-current",
    order_id: currentOrder.id,
    product_id: "PROD-001",
    variant_id: "VAR-001",
    qty: 1,
    unit_price: 25_000,
    gross_line_total: 25_000,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 0,
    net_line_total: 25_000,
    product_snapshot_json: JSON.stringify({ name: "Coffee" }),
    variant_snapshot_json: JSON.stringify({ size_name: "M" }),
    modifiers_snapshot_json: "[]",
  };
  const rootEvent = {
    id: "event-root",
    order_id: rootOrder.id,
    event_at: "2026-07-01T01:00:00.000Z",
    event_type: "CREATED",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Products") return [{ id: "PROD-001", name: "Coffee" }];
      if (sheet === "Product_Variants") return [{ id: "VAR-001", size_name: "M" }];
      if (sheet === "Brands") return [{ id: "BR-001", code: "UCK" }];
      return [];
    });
    mocks.findAllNoCache.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") return [rootOrder, currentOrder, { id: "ord-unrelated" }];
      if (sheet === "Order_Lines_V2") return [currentLine, { id: "line-unrelated", order_id: "ord-unrelated" }];
      if (sheet === "Order_Events") return [rootEvent, { id: "event-unrelated", order_id: "ord-unrelated" }];
      return [];
    });
    mocks.findById.mockImplementation(async (_sheet: string, id: string) => (
      id === currentOrder.id ? currentOrder : id === rootOrder.id ? rootOrder : null
    ));
    mocks.findAllWhere.mockResolvedValue([currentOrder]);
    mocks.findAllWhereInBatches.mockImplementation(async (sheet: string) => (
      sheet === "Order_Lines_V2" ? [currentLine] : sheet === "Order_Events" ? [rootEvent] : []
    ));
  });

  it("queries only the selected order chain, lines, and events", async () => {
    const result = await getOrderDetailV2(currentOrder.id);

    expect(result?.order.id).toBe(currentOrder.id);
    expect(result?.order.lines.map(line => line.id)).toEqual([currentLine.id]);
    expect(result?.timeline.map(order => order.id)).toEqual([rootOrder.id, currentOrder.id]);
    expect(result?.events.map(event => event.id)).toEqual([rootEvent.id]);
    expect(mocks.findById).toHaveBeenCalledWith("Orders_V2", currentOrder.id);
    expect(mocks.findAllWhere).toHaveBeenCalledWith("Orders_V2", {
      eq: { parent_order_id: rootOrder.id },
    });
    expect(mocks.findAllWhereInBatches).toHaveBeenCalledWith(
      "Order_Lines_V2",
      "order_id",
      [currentOrder.id],
    );
    expect(mocks.findAllWhereInBatches).toHaveBeenCalledWith(
      "Order_Events",
      "order_id",
      [rootOrder.id, currentOrder.id],
    );
    expect(mocks.findAllNoCache).not.toHaveBeenCalledWith("Orders_V2");
    expect(mocks.findAllNoCache).not.toHaveBeenCalledWith("Order_Lines_V2");
    expect(mocks.findAllNoCache).not.toHaveBeenCalledWith("Order_Events");
  });
});
