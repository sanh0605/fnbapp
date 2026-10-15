import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/tables", () => ({ findAllWhere: vi.fn() }));

import { findAllWhere } from "@/lib/db/tables";
import { findCompletedOrders, sumNetByOrder, buildCanonicalModifierLookup } from "./report-helpers";

describe("sumNetByOrder (B7)", () => {
  it("matches the old per-order filter+reduce on a randomised set, bit for bit", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const lines = Array.from({ length: 3000 }, () => ({
      order_id: `O${Math.floor(rnd() * 400)}`,
      net_line_total: Math.round(rnd() * 1e6) / 10 + 0.1,
    }));
    const byOrder = sumNetByOrder(lines);
    for (let i = 0; i < 400; i++) {
      const id = `O${i}`;
      const old = lines.filter(l => l.order_id === id).reduce((s, l) => s + l.net_line_total, 0);
      expect(byOrder.get(id) ?? 0).toBe(old);
    }
  });
});

describe("buildCanonicalModifierLookup", () => {
  it("prioritizes status === 'ACTIVE' over stopped/inactive modifier with the same name", () => {
    const modifiers = [
      { id: "MOD-OLD-DAU", name: "Dâu sấy", status: "INACTIVE", created_at: "2026-06-01T00:00:00.000Z" },
      { id: "MOD-NEW-DAU", name: "Dâu sấy", status: "ACTIVE", created_at: "2026-06-20T00:00:00.000Z" },
    ];
    const { byId, byName } = buildCanonicalModifierLookup(modifiers);
    expect(byId.get("MOD-OLD-DAU")?.id).toBe("MOD-NEW-DAU");
    expect(byId.get("MOD-NEW-DAU")?.id).toBe("MOD-NEW-DAU");
    expect(byName.get("dau say")?.id).toBe("MOD-NEW-DAU");
  });
});

describe("findCompletedOrders", () => {
  it("drops an order that a later version replaced, so every report counts the same orders", async () => {
    (findAllWhere as any).mockResolvedValue([
      { id: "O1", superseded_by: "" },
      { id: "O2", superseded_by: "O3" },
      { id: "O3", superseded_by: null },
    ]);
    const orders = await findCompletedOrders(null);
    expect(orders.map(o => o.id)).toEqual(["O1", "O3"]);
  });
});
