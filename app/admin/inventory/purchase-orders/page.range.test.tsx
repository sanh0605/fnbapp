import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPurchaseOrdersPage = vi.hoisted(() => vi.fn());
const PurchaseOrdersClient = vi.hoisted(() => () => null);
vi.mock("./actions", () => ({ getPurchaseOrdersPage }));
vi.mock("./components/PurchaseOrdersClient", () => ({ default: PurchaseOrdersClient }));

import PurchaseOrdersPage from "./page";

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

describe("purchase orders page time filter (BR-UI-007)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T09:00:00Z"));
    getPurchaseOrdersPage.mockReset();
    getPurchaseOrdersPage.mockResolvedValue({ rows: [], total: 0, page: 1, pageCount: 1, firstIndex: 0, lastIndex: 0, rangeError: false, daySpan: null, suppliers: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("Tháng trước is September", async () => {
    const tree = await PurchaseOrdersPage({ searchParams: { range: "LAST_MONTH" } });
    const arg = getPurchaseOrdersPage.mock.calls[0][0];
    expect(arg.from).toBe("2026-09-01");
    expect(arg.to).toBe("2026-09-30");
    expect(propsOf(tree, PurchaseOrdersClient).range.preset).toBe("LAST_MONTH");
  });

  it("a typed name is searched on every day, the supplier filter still applies", async () => {
    const tree = await PurchaseOrdersPage({ searchParams: { q: "sữa tươi", supplier: "NCC-001" } });
    const arg = getPurchaseOrdersPage.mock.calls[0][0];
    expect(arg.from).toBeUndefined();
    expect(arg.to).toBeUndefined();
    expect(arg.supplier).toBe("NCC-001");
    expect(propsOf(tree, PurchaseOrdersClient).searching).toBe(true);
  });

  it("a Sổ thu chi purchase link keeps its day and payment", async () => {
    await PurchaseOrdersPage({ searchParams: { range: "CUSTOM", from: "2026-09-16", to: "2026-09-16", pay: "BANK_TRANSFER" } });
    const arg = getPurchaseOrdersPage.mock.calls[0][0];
    expect(arg.from).toBe("2026-09-16");
    expect(arg.to).toBe("2026-09-16");
    expect(arg.pay).toBe("BANK_TRANSFER");
  });
});
