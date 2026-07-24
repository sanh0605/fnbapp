import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSupabaseClient: vi.fn(),
  findAllWhereInBatches: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));
vi.mock("@/lib/sheets_db", () => ({
  findAllWhereInBatches: mocks.findAllWhereInBatches,
}));

import { getActivityLogEvents } from "./actions";

function query(result: unknown) {
  const builder: Record<string, any> = {};
  for (const method of ["select", "eq", "gte", "lte", "ilike", "limit", "or", "not", "order", "range"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe("getActivityLogEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
    mocks.findAllWhereInBatches.mockResolvedValue([
      { id: "order-1", order_no: "PHD001001" },
    ]);
  });

  it("rejects before querying when the caller is not an administrator", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Forbidden" });

    await expect(getActivityLogEvents()).rejects.toThrow("Forbidden");
    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
  });

  it("sanitizes text search, filters in PostgREST, paginates, and enriches only the returned page", async () => {
    const orderSearch = query({ data: [{ id: "order-1" }], error: null });
    const events = query({
      data: [{
        id: "event-1",
        order_id: "order-1",
        event_type: "VOIDED",
        event_at: "2026-07-24T10:00:00.000Z",
        actor_name: "Admin",
        delta_json: { voided: true },
      }],
      count: 41,
      error: null,
    });
    const actors = query({
      data: [{ actor_name: "Admin" }, { actor_name: "Admin" }, { actor_name: "Cashier" }],
      error: null,
    });
    let eventQueryCount = 0;
    const from = vi.fn((table: string) => {
      if (table === "orders_v2") return orderSearch;
      if (table === "order_events") return eventQueryCount++ === 0 ? events : actors;
      throw new Error(`Unexpected table ${table}`);
    });
    mocks.getSupabaseClient.mockReturnValue({ from });

    const result = await getActivityLogEvents({
      page: 2,
      q: "PHD(001),",
      type: "VOIDED",
      actor: "Admin",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
    });

    expect(orderSearch.ilike).toHaveBeenCalledWith("order_no", "%PHD001%");
    expect(events.eq).toHaveBeenCalledWith("event_type", "VOIDED");
    expect(events.eq).toHaveBeenCalledWith("actor_name", "Admin");
    expect(events.gte).toHaveBeenCalledWith("event_at", "2026-07-01T00:00:00.000Z");
    expect(events.lte).toHaveBeenCalledWith("event_at", "2026-07-31T23:59:59.999Z");
    expect(events.or).toHaveBeenCalledWith(
      "id.ilike.%PHD001%,reason.ilike.%PHD001%,actor_name.ilike.%PHD001%,order_id.in.(order-1)",
    );
    expect(events.order).toHaveBeenCalledWith("event_at", { ascending: false });
    expect(events.range).toHaveBeenCalledWith(20, 39);
    expect(mocks.findAllWhereInBatches).toHaveBeenCalledWith(
      "Orders_V2",
      "id",
      ["order-1"],
    );
    expect(result.events).toEqual([expect.objectContaining({
      id: "event-1",
      order_no: "PHD001001",
      delta_json: JSON.stringify({ voided: true }),
    })]);
    expect(result.totalCount).toBe(41);
    expect(result.itemsPerPage).toBe(20);
    expect(result.actors).toEqual(["Admin", "Cashier"]);
  });
});
