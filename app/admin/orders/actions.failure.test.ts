import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  insert: mocks.insert,
  insertMany: mocks.insertMany,
  update: mocks.update,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { voidOrderV2 } from "./actions";

type MutableState = {
  orders: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
};

describe("voidOrderV2 forced failures", () => {
  let state: MutableState;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      orders: [{
        id: "ord-void-1",
        order_no: "UCK-VOID-1",
        status: "COMPLETED",
        version: 1,
        net_total: 25_000,
      }],
      events: [],
      ledger: [{
        id: "stk-consume-1",
        transaction_type: "SALES_CONSUME",
        reference_id: "ord-void-1",
        item_reference: "ING-001",
        quantity_change: -10,
        unit_cost: 100,
        cost_at_sale: 1_000,
        source: "VARIANT_RECIPE",
      }],
    };

    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.findAll.mockResolvedValue([]);
    mocks.findAllNoCache.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") return state.orders.map(row => ({ ...row }));
      if (sheet === "Order_Events") return state.events.map(row => ({ ...row }));
      if (sheet === "Stock_Ledger") return state.ledger.map(row => ({ ...row }));
      return [];
    });
    mocks.insertMany.mockImplementation(async (sheet: string, rows: Array<Record<string, unknown>>) => {
      if (sheet === "Stock_Ledger") state.ledger.push(...rows.map(row => ({ ...row })));
    });
    mocks.insert.mockImplementation(async (sheet: string, row: Record<string, unknown>) => {
      if (sheet === "Order_Events") state.events.push({ ...row });
    });
    mocks.update.mockImplementation(async (sheet: string, id: string, patch: Record<string, unknown>) => {
      if (sheet !== "Orders_V2") return;
      const order = state.orders.find(row => row.id === id);
      if (order) Object.assign(order, patch);
    });
  });

  it("leaves no mutation when the reversal batch fails before writing", async () => {
    mocks.insertMany.mockRejectedValueOnce(new Error("reversal write failed"));

    const failed = await voidOrderV2("ord-void-1", "Khách yêu cầu hủy");

    expect(failed).toEqual({ success: false, error: "reversal write failed" });
    expect(reversalRows(state)).toHaveLength(0);
    expect(state.events).toHaveLength(0);
    expect(state.orders[0].status).toBe("COMPLETED");

    const retry = await voidOrderV2("ord-void-1", "Khách yêu cầu hủy");
    expect(retry).toEqual({ success: true });
    expect(reversalRows(state)).toHaveLength(1);
    expect(state.orders[0].status).toBe("VOIDED");
  });

  it("duplicates the stock reversal when event insert fails and the operator retries", async () => {
    mocks.insert.mockRejectedValueOnce(new Error("event write failed"));

    const failed = await voidOrderV2("ord-void-1", "Khách yêu cầu hủy");

    expect(failed).toEqual({ success: false, error: "event write failed" });
    expect(reversalRows(state)).toHaveLength(1);
    expect(state.events).toHaveLength(0);
    expect(state.orders[0].status).toBe("COMPLETED");

    const retry = await voidOrderV2("ord-void-1", "Khách yêu cầu hủy");

    expect(retry).toEqual({ success: true });
    expect(reversalRows(state)).toHaveLength(2);
    expect(state.events).toHaveLength(1);
    expect(state.orders[0].status).toBe("VOIDED");
  });

  it("blocks retry after event succeeds but the final status update fails", async () => {
    mocks.update.mockRejectedValueOnce(new Error("status write failed"));

    const failed = await voidOrderV2("ord-void-1", "Khách yêu cầu hủy");

    expect(failed).toEqual({ success: false, error: "status write failed" });
    expect(reversalRows(state)).toHaveLength(1);
    expect(state.events).toHaveLength(1);
    expect(state.orders[0].status).toBe("COMPLETED");

    const retry = await voidOrderV2("ord-void-1", "Khách yêu cầu hủy");

    expect(retry.success).toBe(false);
    expect(retry.error).toContain("VOIDED");
    expect(reversalRows(state)).toHaveLength(1);
    expect(state.events).toHaveLength(1);
    expect(state.orders[0].status).toBe("COMPLETED");
  });
});

function reversalRows(state: MutableState): Array<Record<string, unknown>> {
  return state.ledger.filter(row => row.transaction_type === "EDIT_REVERSAL");
}
