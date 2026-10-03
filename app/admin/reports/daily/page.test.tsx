import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const getDailyDigest = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ getDailyDigest }));
vi.mock("./DailyDigestFilter", () => ({ DailyDigestFilter: () => null }));

import DailyDigestPage from "./page";

function collectText(node: ReactNode, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach(n => collectText(n, out));
    return out;
  }
  const el = node as { props?: { children?: ReactNode } };
  if (el.props) collectText(el.props.children, out);
  return out;
}

describe("daily report label (A13)", () => {
  it("keeps the long weekday wording for the chosen day", async () => {
    getDailyDigest.mockResolvedValue({
      date: "2026-09-15",
      today: { revenue: 0, orderCount: 0, avgOrderValue: 0 },
      vsYesterday: { revenueDeltaPct: null, orderCountDelta: 0 },
      vsSameWeekdayLastWeek: { revenueDeltaPct: null, orderCountDelta: 0 },
      topItems: [],
      paymentBreakdown: [],
    });
    const tree = await DailyDigestPage({ searchParams: { date: "2026-09-15" } });
    const text = collectText(tree as ReactNode).join("|");
    expect(text).toContain("Thứ Ba, 15/09/2026");
    expect(text).toMatch(/So|Thứ Ba|tuần trước/);
  });
});
