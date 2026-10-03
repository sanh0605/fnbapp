import { describe, it, expect, vi, beforeEach } from "vitest";
import CategoryDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/finance/categories/actions", () => ({
  getCashCategories: vi.fn().mockResolvedValue([
    { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
  ]),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "usr-1", name: "Chủ quán", role: "ADMIN" },
  }),
}));

describe("CategoryDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when category id is unknown", async () => {
    await expect(
      CategoryDetailPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await CategoryDetailPage({
      params: { id: "CFC-001" },
      searchParams: { returnTo: "/admin/finance/categories" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
