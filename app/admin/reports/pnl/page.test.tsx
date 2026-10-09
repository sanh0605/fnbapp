import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getProfitAndLossReport = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ getProfitAndLossReport }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin/reports/pnl", useSearchParams: () => new URLSearchParams() }));

import ProfitAndLossPage from "./page";
import { DateRangeUrlButton } from "@/components/ui/DateRangeUrlButton";

// Every element of `type` anywhere in the tree, looking through all props.
function elementsOf(node: unknown, type: unknown, out: Array<{ props: any }> = []): Array<{ props: any }> {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach(n => elementsOf(n, type, out));
    return out;
  }
  const el = node as { type?: unknown; props?: Record<string, unknown> };
  if (el.type === type) out.push(el as { props: any });
  if (el.props) Object.values(el.props).forEach(v => elementsOf(v, type, out));
  return out;
}

function report(fromMonth: string, toMonth: string) {
  return {
    availableYears: [2026],
    brandNames: [],
    figures: { fromMonth, toMonth, months: [], expenseCategories: [], firstPaymentDate: null },
    table: { fromMonth, toMonth, rangeName: "năm nay", months: [], rows: [], footnotes: [], chart: [], summary: { revenue: 0, netProfit: 0, margin: null, bestMonth: null, worstMonth: null } },
  };
}

// BR-UI-007 (owner 2026-10-09): Lãi lỗ takes the shared filter in whole months, opening on Năm nay.
describe("Lãi lỗ page time filter", () => {
  beforeEach(() => {
    getProfitAndLossReport.mockReset();
    getProfitAndLossReport.mockImplementation(async (r: { start: string; end: string }) => report(r.start, r.end));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("opens on Năm nay, January to this month, and the button shows it in months", async () => {
    const tree = await ProfitAndLossPage({ searchParams: {} });
    expect(getProfitAndLossReport).toHaveBeenCalledWith({ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" });
    const button = elementsOf(tree, DateRangeUrlButton)[0];
    expect(button.props.mode).toBe("month");
    expect(button.props.value).toEqual({ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" });
    expect(button.props.today).toBe("2026-10-09");
  });

  it("an old ?year=2025 link opens January to December 2025", async () => {
    await ProfitAndLossPage({ searchParams: { year: "2025" } });
    expect(getProfitAndLossReport).toHaveBeenCalledWith({ preset: "CUSTOM", start: "2025-01", end: "2025-12" });
  });

  it("a span with no figures says which months are empty", async () => {
    const tree = await ProfitAndLossPage({ searchParams: { range: "CUSTOM", from: "2025-07", to: "2026-06" } });
    expect(JSON.stringify(tree)).toContain("Từ 07/2025 đến 06/2026 chưa có số liệu nào.");
  });
});
