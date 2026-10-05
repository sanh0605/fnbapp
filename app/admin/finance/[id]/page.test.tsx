import { describe, it, expect, vi, beforeEach } from "vitest";
import CashEntryDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { mockEntry } = vi.hoisted(() => ({
  mockEntry: {
    id: "CE-001",
    entry_date: "2026-09-30",
    category_id: "CFC-001",
    amount: 100000,
    payment_method: "CASH",
    status: "ACTIVE",
  },
}));

vi.mock("@/lib/db/tables", () => ({
  findById: vi.fn().mockImplementation((table: string, id: string) => {
    if (id === "CE-001") return Promise.resolve(mockEntry);
    return Promise.resolve(null);
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "usr-1", name: "Chủ quán", role: "ADMIN" },
  }),
}));

vi.mock("@/app/admin/finance/categories/actions", () => ({
  getCashCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/admin/finance/bank-accounts/actions", () => ({
  getBankAccounts: vi.fn().mockResolvedValue([]),
}));

describe("CashEntryDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when entry id is unknown", async () => {
    await expect(
      CashEntryDetailPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await CashEntryDetailPage({
      params: { id: "CE-001" },
      searchParams: { returnTo: "/admin/finance" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
