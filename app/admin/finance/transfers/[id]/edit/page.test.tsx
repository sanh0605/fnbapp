import { describe, it, expect, vi, beforeEach } from "vitest";
import EditCashTransferPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { mockTransfer } = vi.hoisted(() => ({
  mockTransfer: {
    id: "CT-001",
    transfer_date: "2026-09-10",
    amount: 5000000,
    from_account_id: null,
    to_account_id: "BA-001",
    note: "Chuyển tiền vào ACB",
    status: "ACTIVE",
  },
}));

vi.mock("../../actions", () => ({
  getCashTransfer: vi.fn().mockImplementation((id: string) => {
    if (id === "CT-001") return Promise.resolve(mockTransfer);
    if (id === "CT-CANCELLED")
      return Promise.resolve({ ...mockTransfer, id, status: "CANCELLED" });
    return Promise.resolve(null);
  }),
}));

vi.mock("@/app/admin/finance/bank-accounts/actions", () => ({
  getBankAccounts: vi.fn().mockResolvedValue([]),
}));

describe("EditCashTransferPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when transfer id is unknown", async () => {
    await expect(
      EditCashTransferPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("calls notFound when transfer is already cancelled", async () => {
    await expect(
      EditCashTransferPage({
        params: { id: "CT-CANCELLED" },
        searchParams: {},
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await EditCashTransferPage({
      params: { id: "CT-001" },
      searchParams: { returnTo: "/admin/finance" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(
      true,
    );
  });
});
