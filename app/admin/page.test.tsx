import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockResolvedValue([]),
  findAllNoCache: vi.fn().mockResolvedValue([]),
  findAllWhere: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }),
  }),
}));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin", useSearchParams: () => new URLSearchParams() }));

import AdminDashboard from "./page";
import { DateRangeUrlButton } from "@/components/ui/DateRangeUrlButton";
import { CompareLine } from "@/app/admin/reports/components/CompareLine";

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
  // Wave K5: the header moved into PageHeader, whose title, subtitle and
  // actions are props rather than children; walk those too.
  const el = node as { props?: { children?: ReactNode; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode } };
  if (el.props) {
    collectText(el.props.title, out);
    collectText(el.props.subtitle, out);
    collectText(el.props.actions, out);
    collectText(el.props.children, out);
  }
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
    const tree = await AdminDashboard({ searchParams: {} });
    const text = collectText(tree as ReactNode).join("");
    expect(text).toContain("Cập nhật lúc: 06:30:00");
  });

  it("the 7-day chart ends on the Saigon day, 15/09", async () => {
    const tree = await AdminDashboard({ searchParams: {} });
    const text = collectText(tree as ReactNode).join("|");
    expect(text).toContain("15/09");
  });

  it("shows 'TB đơn' without '(AOV)' in KPI card", async () => {
    const tree = await AdminDashboard({ searchParams: {} });
    const text = collectText(tree as ReactNode).join("|");
    expect(text).toContain("TB đơn");
    expect(text).not.toContain("(AOV)");
  });
});

// Every element of `type` anywhere in the tree, looking through all props, not only children.
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

describe("admin dashboard time filter and compare (BR-UI-007)", () => {
  const order = (id: string, createdAt: string, net: number) => ({
    id, status: "COMPLETED", superseded_by: "", created_at: createdAt, net_total: net, gross_total: net, version: 1, created_by_name: "a", brand_id: "B1",
  });
  // 09/10 Saigon: two orders, 150,000; 08/10: one, 120,000; 02/10: none.
  const ORDERS = [
    order("o1", "2026-10-09T02:00:00Z", 100000),
    order("o2", "2026-10-09T03:00:00Z", 50000),
    order("o3", "2026-10-08T02:00:00Z", 120000),
  ];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T09:00:00Z"));
    const tables = await import("@/lib/db/tables");
    (tables.findAllWhere as any).mockImplementation((sheet: string) => Promise.resolve(sheet === "Orders_V2" ? ORDERS : []));
  });
  afterEach(async () => {
    vi.useRealTimers();
    const tables = await import("@/lib/db/tables");
    (tables.findAllWhere as any).mockReset();
    (tables.findAllWhere as any).mockResolvedValue([]);
  });

  it("Hôm nay compares with yesterday and with Friday last week", async () => {
    const tree = await AdminDashboard({ searchParams: { range: "TODAY" } });
    expect(elementsOf(tree, DateRangeUrlButton)[0].props.value).toEqual({ preset: "TODAY", start: "2026-10-09", end: "2026-10-09" });
    const lines = elementsOf(tree, CompareLine).map(e => e.props);
    expect(lines).toContainEqual({ change: 25, label: "so với hôm qua" });
    expect(lines).toContainEqual({ change: null, label: "so với thứ Sáu 02/10" });
  });

  it("opens on Tháng này and compares with 01/09 – 09/09", async () => {
    const tree = await AdminDashboard({ searchParams: {} });
    expect(elementsOf(tree, DateRangeUrlButton)[0].props.value).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
    const labels = elementsOf(tree, CompareLine).map(e => e.props.label);
    expect(labels).toContain("so với 01/09 – 09/09");
    expect(collectText(tree as ReactNode).join("|")).not.toContain("Tất cả");
  });

  it("five cards compare; Nhà cung cấp does not", async () => {
    const tree = await AdminDashboard({ searchParams: { range: "LAST_7_DAYS" } });
    expect(elementsOf(tree, CompareLine)).toHaveLength(5);
  });

  it("at 06:30 on 01/10 Saigon Tháng này is October", async () => {
    vi.setSystemTime(new Date("2026-09-30T23:30:00Z"));
    const tree = await AdminDashboard({ searchParams: {} });
    expect(elementsOf(tree, DateRangeUrlButton)[0].props.value).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
  });
});
