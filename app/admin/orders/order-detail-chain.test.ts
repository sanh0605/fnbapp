import { describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => [
  { id: "v1", version: 1, parent_order_id: "", created_by_id: "USR-002", created_by_name: "tuyen2612" },
  { id: "v2", version: 2, parent_order_id: "v1", created_by_id: "USR-404", created_by_name: "ghost" },
  { id: "v3", version: 3, parent_order_id: "v2" },
]);

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn(async (sheet: string) =>
    sheet === "Users" ? [{ id: "USR-002", username: "tuyen2612", name: "Tài Chí Tuyền" }] : []),
  findAllWhereInBatches: vi.fn(async (table: string) =>
    table === "Order_Events"
      ? [{ id: "e1", event_at: "2026-10-17T01:00:00Z", actor_id: "USR-002", actor_name: "tuyen2612", reason: "x" }]
      : []),
  findById: async (_t: string, id: string) => rows.find((r) => r.id === id) ?? null,
  findAllWhere: async (_t: string, q: { eq: { parent_order_id: string } }) =>
    rows.filter((r) => r.parent_order_id === q.eq.parent_order_id),
}));

import { getOrderDetailV2 } from "./order-detail-actions";

describe("order history follows the parent chain", () => {
  it.each(["v1", "v2", "v3"])("opening %s lists v1, v2 and v3", async (id) => {
    const res = await getOrderDetailV2(id);
    expect(res?.timeline.map((t) => t.id)).toEqual(["v1", "v2", "v3"]);
  });
});

describe("order history shows staff names, not logins", () => {
  it("maps the order, each version and each event; unknown people keep the stored text", async () => {
    const res = await getOrderDetailV2("v1");
    expect(res?.order.created_by_name).toBe("Tài Chí Tuyền");
    expect(res?.timeline.map((t) => t.created_by_name)).toEqual(["Tài Chí Tuyền", "ghost", ""]);
    expect(res?.events[0].actor_name).toBe("Tài Chí Tuyền");
  });
});
