import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertOrderV2Records } from "@/lib/sheets-db-v2";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";

vi.mock("@/lib/sheets_db", () => ({
  insert: vi.fn(),
  insertMany: vi.fn(),
  removeMany: vi.fn(),
  getHeaders: vi.fn(),
}));

import { insert, insertMany, removeMany } from "@/lib/sheets_db";

const order: OrderV2 = {
  id: "ord-1", order_no: "UCK001", brand_id: "BR-002", status: "COMPLETED", version: 1,
  parent_order_id: "", superseded_by: "",
  created_at: "2026-06-18T00:00:00Z", created_by_id: "U1", created_by_name: "Test",
  completed_at: "2026-06-18T00:00:00Z",
  voided_at: "", voided_by_id: "", void_reason: "",
  currency: "VND",
  gross_total: 35000, promo_discount_total: 10000, manual_item_discount_total: 0,
  manual_order_discount: 0, net_total: 25000,
  applied_promotion_id: "PRM-003", applied_promotion_snapshot_json: "{}",
  pos_snapshot_json: "{}", payment_method: "CASH", payment_ref: "",
  migration_notes: "",
};

const lines: OrderLineV2[] = [{
  id: "ol-1", order_id: "ord-1", line_no: 1,
  product_id: "P1", product_snapshot_json: "{}",
  variant_id: "V1", variant_snapshot_json: "{}",
  qty: 1, unit_price: 35000, modifiers_snapshot_json: "[]",
  gross_line_total: 35000, promo_discount: 10000, manual_item_discount: 0,
  order_discount_allocation: 0, net_line_total: 25000,
  cost_at_sale: 12000, recipe_snapshot_json: "{}",
  promo_discount_reason: "PRM-003", manual_discount_reason: "",
}];

const event: OrderEvent = {
  id: "evt-1", order_id: "ord-1", event_type: "CREATED",
  event_at: "2026-06-18T00:00:00Z",
  actor_id: "U1", actor_name: "Test",
  from_version: "", to_version: 1, previous_order_id: "",
  delta_json: "{}", reason: "POS checkout",
};

const ledger = [{
  id: "stk-1", transaction_type: "SALES_CONSUME",
  reference_id: "ord-1", item_reference: "BI-MILK",
  quantity_change: -0.05, unit_cost: 20000,
  created_at: "2026-06-18T00:00:00Z", order_event_id: "evt-1",
  cost_at_sale: 1000,
}];

describe("insertOrderV2Records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts order, lines, event, ledger in sequence", async () => {
    (insert as any).mockResolvedValue(order);
    (insertMany as any).mockResolvedValue([]);

    const result = await insertOrderV2Records({ order, lines, event, ledgerEntries: ledger });

    expect(result.success).toBe(true);
    expect(insert).toHaveBeenCalledWith("Orders_V2", order);
    expect(insertMany).toHaveBeenCalledWith("Order_Lines_V2", lines);
    expect(insert).toHaveBeenCalledWith("Order_Events", event);
    expect(insertMany).toHaveBeenCalledWith("Stock_Ledger", ledger);
  });

  it("rolls back on line insert failure", async () => {
    (insert as any).mockResolvedValueOnce(order); // Orders_V2 succeeds
    (insertMany as any).mockRejectedValueOnce(new Error("lines failed")); // Order_Lines_V2 fails
    (removeMany as any).mockResolvedValue(true);

    const result = await insertOrderV2Records({ order, lines, event, ledgerEntries: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/lines failed/);
    }
    expect(removeMany).toHaveBeenCalledWith("Orders_V2", [order.id]); // cleanup
  });

  it("rolls back all on ledger insert failure", async () => {
    (insert as any).mockResolvedValue(order);
    (insertMany as any)
      .mockResolvedValueOnce([]) // Order_Lines_V2 ok
      .mockResolvedValueOnce([]); // Order_Lines_V2 again? need to fix this
    // Actually: insertMany is called for Order_Lines_V2 then Stock_Ledger.
    // Stock_Ledger fails.
    (insertMany as any).mockReset();
    (insertMany as any)
      .mockResolvedValueOnce([]) // Order_Lines_V2
      .mockRejectedValueOnce(new Error("ledger failed")); // Stock_Ledger
    (removeMany as any).mockResolvedValue(true);

    const result = await insertOrderV2Records({ order, lines, event, ledgerEntries: ledger });

    expect(result.success).toBe(false);
    expect(removeMany).toHaveBeenCalledWith("Orders_V2", [order.id]);
    expect(removeMany).toHaveBeenCalledWith("Order_Events", [event.id]);
    expect(removeMany).toHaveBeenCalledWith("Order_Lines_V2", lines.map(l => l.id));
  });

  it("handles empty lines or ledger gracefully", async () => {
    (insert as any).mockResolvedValue(order);
    (insertMany as any).mockResolvedValue([]);

    const result = await insertOrderV2Records({ order, lines: [], event, ledgerEntries: [] });

    expect(result.success).toBe(true);
    expect(insertMany).not.toHaveBeenCalled(); // empty arrays are skipped
  });
});
