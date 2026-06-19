import { describe, it, expect, vi, beforeEach } from "vitest";
import { supersedeOrderV2 } from "@/lib/sheets-db-v2-edit";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";

vi.mock("@/lib/sheets_db", () => ({
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  removeMany: vi.fn(),
  getHeaders: vi.fn(),
  findAllNoCache: vi.fn(),
}));

import { insert, insertMany, update, findAllNoCache, remove, removeMany } from "@/lib/sheets_db";

const oldOrder: OrderV2 = {
  id: "ord-v1", order_no: "UCK001", brand_id: "BR-002", status: "COMPLETED", version: 1,
  parent_order_id: "", superseded_by: "",
  created_at: "2026-06-18T00:00:00Z", created_by_id: "U1", created_by_name: "Cashier",
  completed_at: "2026-06-18T00:00:00Z",
  voided_at: "", voided_by_id: "", void_reason: "",
  currency: "VND",
  gross_total: 35000, promo_discount_total: 10000, manual_item_discount_total: 0,
  manual_order_discount: 0, net_total: 25000,
  applied_promotion_id: "PRM-003", applied_promotion_snapshot_json: "{}",
  pos_snapshot_json: "{}", payment_method: "CASH", payment_ref: "",
  migration_notes: "",
};

const newOrder: OrderV2 = {
  ...oldOrder,
  id: "ord-v2", version: 2, parent_order_id: "ord-v1",
  gross_total: 70000, promo_discount_total: 20000, net_total: 50000,
};

const newLines: OrderLineV2[] = [{
  id: "ol-v2-1", order_id: "ord-v2", line_no: 1,
  product_id: "P1", product_snapshot_json: "{}",
  variant_id: "V1", variant_snapshot_json: "{}",
  qty: 2, unit_price: 35000, modifiers_snapshot_json: "[]",
  gross_line_total: 70000, promo_discount: 20000, manual_item_discount: 0,
  order_discount_allocation: 0, net_line_total: 50000,
  cost_at_sale: 24000, recipe_snapshot_json: "{}",
  promo_discount_reason: "PRM-003", manual_discount_reason: "",
}];

const event: OrderEvent = {
  id: "evt-edit-1", order_id: "ord-v2", event_type: "EDITED",
  event_at: "2026-06-19T00:00:00Z",
  actor_id: "U2", actor_name: "Manager",
  from_version: 1, to_version: 2, previous_order_id: "ord-v1",
  delta_json: "{}", reason: "Customer added 1 more cup",
};

const reversalEntries = [{
  id: "stk-rev-1", transaction_type: "EDIT_REVERSAL",
  reference_id: "ord-v1", item_reference: "BI-MILK",
  quantity_change: 0.05, unit_cost: 0, // positive (reversal of negative consume)
  created_at: "2026-06-19T00:00:00Z", order_event_id: "evt-edit-1",
  cost_at_sale: 0, source: "VARIANT_RECIPE",
}];

const consumeEntries = [{
  id: "stk-new-1", transaction_type: "SALES_CONSUME",
  reference_id: "ord-v2", item_reference: "BI-MILK",
  quantity_change: -0.10, unit_cost: 0,
  created_at: "2026-06-19T00:00:00Z", order_event_id: "evt-edit-1",
  cost_at_sale: 0, source: "VARIANT_RECIPE",
}];

describe("supersedeOrderV2", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks old order as SUPERSEDED with superseded_by pointing to new", async () => {
    (update as any).mockResolvedValue({});
    (insert as any).mockResolvedValue({});
    (insertMany as any).mockResolvedValue([]);
    (findAllNoCache as any).mockResolvedValue([oldOrder]);

    const result = await supersedeOrderV2({
      oldOrderId: "ord-v1",
      expectedOldVersion: 1,
      newOrder,
      newLines,
      event,
      reversalEntries,
      consumeEntries,
    });

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith("Orders_V2", "ord-v1", expect.objectContaining({
      status: "SUPERSEDED",
      superseded_by: "ord-v2",
    }));
  });

  it("rejects if old order version != expectedOldVersion (optimistic lock)", async () => {
    (findAllNoCache as any).mockResolvedValue([{ ...oldOrder, version: 5 }]); // version mismatch

    const result = await supersedeOrderV2({
      oldOrderId: "ord-v1",
      expectedOldVersion: 1, // we thought it was v1, but it's v5
      newOrder, newLines, event, reversalEntries, consumeEntries,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/version/i);
  });

  it("rejects if old order is not COMPLETED", async () => {
    (findAllNoCache as any).mockResolvedValue([{ ...oldOrder, status: "VOIDED" }]);

    const result = await supersedeOrderV2({
      oldOrderId: "ord-v1", expectedOldVersion: 1,
      newOrder, newLines, event, reversalEntries, consumeEntries,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/status/i);
  });

  it("inserts new order, lines, event, reversal + consume ledger in sequence", async () => {
    (update as any).mockResolvedValue({});
    (insert as any).mockResolvedValue({});
    (insertMany as any).mockResolvedValue([]);
    (findAllNoCache as any).mockResolvedValue([oldOrder]);

    await supersedeOrderV2({
      oldOrderId: "ord-v1", expectedOldVersion: 1,
      newOrder, newLines, event, reversalEntries, consumeEntries,
    });

    expect(update).toHaveBeenCalledWith("Orders_V2", "ord-v1", expect.anything());
    expect(insert).toHaveBeenCalledWith("Orders_V2", newOrder);
    expect(insertMany).toHaveBeenCalledWith("Order_Lines_V2", newLines);
    expect(insert).toHaveBeenCalledWith("Order_Events", event);
    expect(insertMany).toHaveBeenCalledWith("Stock_Ledger", expect.arrayContaining(reversalEntries));
    expect(insertMany).toHaveBeenCalledWith("Stock_Ledger", expect.arrayContaining(consumeEntries));
  });

  it("rolls back on failure (best-effort)", async () => {
    (findAllNoCache as any).mockResolvedValue([oldOrder]);
    (update as any).mockResolvedValue({});
    (insert as any).mockResolvedValue({});
    (insertMany as any).mockRejectedValueOnce(new Error("Order_Lines_V2 write failed"));
    (remove as any).mockResolvedValue({});

    const result = await supersedeOrderV2({
      oldOrderId: "ord-v1", expectedOldVersion: 1,
      newOrder, newLines, event, reversalEntries, consumeEntries,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Order_Lines_V2/);
  });
});
