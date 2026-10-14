import { describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => [
  { id: "v1", version: 1, parent_order_id: "" },
  { id: "v2", version: 2, parent_order_id: "v1" },
  { id: "v3", version: 3, parent_order_id: "v2" },
]);

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockResolvedValue([]),
  findAllWhereInBatches: vi.fn().mockResolvedValue([]),
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
