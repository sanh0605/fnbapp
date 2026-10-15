import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/lib/dashboard/dashboard-data";

// vi.mock is hoisted above plain consts, so the data must be hoisted too.
const { MOCK_DATA } = vi.hoisted(() => ({
  MOCK_DATA: {
    posSyncFailureCount: 0,
    negativeStock: [],
    stocktake: { stale: null, openTooLong: [] },
    reminders: [],
    table: [],
    foodColumns: [],
    toppingColumnName: null,
  } as DashboardData,
}));

vi.mock("@/lib/dashboard/dashboard-data", () => ({
  getDashboardData: vi.fn().mockResolvedValue(MOCK_DATA),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import AdminDashboard from "./page";
import { DateRangeUrlButton } from "@/components/ui/DateRangeUrlButton";
import { CompareLine } from "@/app/admin/reports/components/CompareLine";
import { DashboardView } from "@/app/admin/components/DashboardView";

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
  const el = node as { props?: { children?: ReactNode; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode } };
  if (el.props) {
    collectText(el.props.title, out);
    collectText(el.props.subtitle, out);
    collectText(el.props.actions, out);
    collectText(el.props.children, out);
  }
  return out;
}

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

describe("admin dashboard clock (A6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-09-14T23:30:00Z = 15/09/2026 06:30:00 Saigon
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("shows the update time in Saigon, not 7 hours behind", async () => {
    const tree = await AdminDashboard({ searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join("");
    expect(text).toContain("Cập nhật lúc: 06:30:00");
  });
});

describe("admin dashboard drops old controls (BR-UI-007)", () => {
  it("renders no DateRangeUrlButton or CompareLine", async () => {
    const tree = await AdminDashboard({ searchParams: Promise.resolve({}) });
    expect(elementsOf(tree, DateRangeUrlButton)).toHaveLength(0);
    expect(elementsOf(tree, CompareLine)).toHaveLength(0);
  });

  it("renders PageHeader with title and link to dashboard settings", async () => {
    const tree = await AdminDashboard({ searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join("|");
    expect(text).toContain("Tổng quan");
    expect(text).toContain("Việc cần xử lý và bán hàng 7 ngày qua.");
    expect(text).toContain("Cài đặt Tổng quan");
  });

  it("renders DashboardView with loaded data", async () => {
    const tree = await AdminDashboard({ searchParams: Promise.resolve({}) });
    const views = elementsOf(tree, DashboardView);
    expect(views).toHaveLength(1);
    expect(views[0].props.data).toEqual(MOCK_DATA);
  });
});
