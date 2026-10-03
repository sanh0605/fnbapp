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

import AdminDashboard from "./page";

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
});
