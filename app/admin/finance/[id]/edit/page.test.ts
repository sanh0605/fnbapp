import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  getCashCategories: vi.fn(),
  getBankAccounts: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/db/tables", () => ({
  findById: mocks.findById,
}));

vi.mock("../../categories/actions", () => ({
  getCashCategories: mocks.getCashCategories,
}));

vi.mock("../../bank-accounts/actions", () => ({
  getBankAccounts: mocks.getBankAccounts,
}));

vi.mock("../../components/CashEntryForm", () => ({
  CashEntryForm: (props: any) => ({ type: "CashEntryForm", props }),
}));

import EditCashEntryPage from "./page";

describe("EditCashEntryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCashCategories.mockResolvedValue([]);
    mocks.getBankAccounts.mockResolvedValue([]);
  });

  it("calls notFound when entry does not exist", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(
      EditCashEntryPage({ params: { id: "CE-999" } })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("calls notFound when entry is CANCELLED", async () => {
    mocks.findById.mockResolvedValue({
      id: "CE-002",
      status: "CANCELLED",
      entry_date: "2026-07-16",
    });

    await expect(
      EditCashEntryPage({ params: { id: "CE-002" } })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("renders CashEntryForm with the entry when ACTIVE", async () => {
    const activeEntry = {
      id: "CE-001",
      entry_date: "2026-07-15",
      category_id: "CFC-001",
      amount: 100000,
      payment_method: "CASH",
      bank_account_id: null,
      note: null,
      status: "ACTIVE",
    };
    mocks.findById.mockResolvedValue(activeEntry);

    const element: any = await EditCashEntryPage({
      params: { id: "CE-001" },
      searchParams: { returnTo: "/admin/finance?preset=LAST_MONTH" },
    });

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(element).toBeDefined();

    const formNode = element.props.children[2];
    expect(formNode.props.entry).toEqual(activeEntry);
    expect(formNode.props.returnTo).toBe("/admin/finance?preset=LAST_MONTH");
  });
});
