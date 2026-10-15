import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getOrdersV2 = vi.hoisted(() => vi.fn());
const OrderTable = vi.hoisted(() => () => null);
vi.mock("./actions", () => ({ getOrdersV2 }));
vi.mock("./OrderTable", () => ({ default: OrderTable }));

import OrdersPage from "./page";

// Server pages return a JSX tree; find the client element's props without rendering it.
function propsOf(tree: any, type: unknown): any {
  if (!tree || typeof tree !== "object") return undefined;
  if (tree.type === type) return tree.props;
  const kids = tree.props?.children;
  for (const k of Array.isArray(kids) ? kids : [kids]) {
    const hit = propsOf(k, type);
    if (hit) return hit;
  }
  return undefined;
}

describe("orders page time filter (BR-UI-007)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T09:00:00Z"));
    getOrdersV2.mockReset();
    getOrdersV2.mockResolvedValue({ orders: [], totalCount: 0, itemsPerPage: 20, brands: [], products: [], variants: [], modifiers: [], categories: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("opens on Tháng này: whole Saigon days 01/10 to 31/10", async () => {
    const tree = await OrdersPage({ searchParams: Promise.resolve({}) });
    const arg = getOrdersV2.mock.calls[0][0];
    expect(arg.from).toBe("2026-09-30T17:00:00.000Z");
    expect(arg.to).toBe("2026-10-31T16:59:59.999Z");
    const props = propsOf(tree, OrderTable);
    expect(props.range).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
    expect(props.today).toBe("2026-10-09");
    expect(props.searching).toBe(false);
  });

  it("at 06:30 on 01/10 Saigon (23:30 UTC on 30/09) Tháng này is October", async () => {
    vi.setSystemTime(new Date("2026-09-30T23:30:00Z"));
    await OrdersPage({ searchParams: Promise.resolve({}) });
    expect(getOrdersV2.mock.calls[0][0].from).toBe("2026-09-30T17:00:00.000Z");
  });

  it("a Sổ thu chi day link (from/to, no range) shows that day only and keeps the payment filter", async () => {
    const tree = await OrdersPage({ searchParams: Promise.resolve({ from: "2026-10-05", to: "2026-10-05", payment: "Tien mat" }) });
    const arg = getOrdersV2.mock.calls[0][0];
    expect(arg.from).toBe("2026-10-04T17:00:00.000Z");
    expect(arg.to).toBe("2026-10-05T16:59:59.999Z");
    expect(arg.payment).toBe("Tien mat");
    expect(propsOf(tree, OrderTable).range).toEqual({ preset: "CUSTOM", start: "2026-10-05", end: "2026-10-05" });
  });

  it("a typed search looks through every day; the range stays on the address", async () => {
    const tree = await OrdersPage({ searchParams: Promise.resolve({ q: "PHD000123", range: "LAST_MONTH", brand: "B1" }) });
    const arg = getOrdersV2.mock.calls[0][0];
    expect(arg.from).toBeUndefined();
    expect(arg.to).toBeUndefined();
    expect(arg.q).toBe("PHD000123");
    expect(arg.brand).toBe("B1");
    const props = propsOf(tree, OrderTable);
    expect(props.searching).toBe(true);
    expect(props.range.preset).toBe("LAST_MONTH");
  });

  it("spaces alone are not a search", async () => {
    await OrdersPage({ searchParams: Promise.resolve({ q: "   " }) });
    expect(getOrdersV2.mock.calls[0][0].from).toBe("2026-09-30T17:00:00.000Z");
  });
});
