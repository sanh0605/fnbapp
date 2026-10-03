import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrdersV2 = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ getOrdersV2 }));
vi.mock("./OrderTable", () => ({ default: () => null }));

import OrdersPage from "./page";

describe("orders page day window (A1)", () => {
  beforeEach(() => {
    getOrdersV2.mockReset();
    getOrdersV2.mockResolvedValue({
      orders: [], totalCount: 0, itemsPerPage: 20, brands: [], products: [], variants: [], modifiers: [], categories: [],
    });
  });

  it("filtering 15/09/2026 spans Saigon 00:00:00 to 23:59:59.999, so a 06:30 order is inside", async () => {
    await OrdersPage({ searchParams: { from: "2026-09-15", to: "2026-09-15" } });
    const arg = getOrdersV2.mock.calls[0][0];
    expect(arg.from).toBe("2026-09-14T17:00:00.000Z");
    expect(arg.to).toBe("2026-09-15T16:59:59.999Z");
    // 06:30 Saigon on 15/09 = 2026-09-14T23:30:00Z
    const order = new Date("2026-09-14T23:30:00Z").getTime();
    expect(order).toBeGreaterThanOrEqual(new Date(arg.from).getTime());
    expect(order).toBeLessThanOrEqual(new Date(arg.to).getTime());
  });
});
