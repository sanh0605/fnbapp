import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/tables", () => ({ findAllWhere: vi.fn() }));

import { sumNetByOrder } from "./report-helpers";

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
