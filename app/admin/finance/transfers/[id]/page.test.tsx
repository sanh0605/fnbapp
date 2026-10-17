import { describe, it, expect, vi, beforeEach } from "vitest";
import CashTransferDetailPage from "./page";

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
    created_by_id: "USR-002",
    created_by_name: "tuyen2612",
  },
}));

vi.mock("../actions", () => ({
  getCashTransfer: vi.fn().mockImplementation((id: string) => {
    if (id === "CT-001") return Promise.resolve(mockTransfer);
    return Promise.resolve(null);
  }),
}));

vi.mock("@/lib/auth/staff-names", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/staff-names")>();
  return {
    ...real,
    loadStaffNameResolver: async () =>
      real.buildStaffNameResolver([{ id: "USR-002", username: "tuyen2612", name: "Tài Chí Tuyền" }]),
  };
});

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "usr-1", name: "Chủ quán", role: "ADMIN" },
  }),
}));

vi.mock("@/app/admin/finance/bank-accounts/actions", () => ({
  getBankAccounts: vi.fn().mockResolvedValue([]),
}));

describe("CashTransferDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when transfer id is unknown", async () => {
    await expect(
      CashTransferDetailPage({ params: Promise.resolve({ id: "UNKNOWN" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await CashTransferDetailPage({
      params: Promise.resolve({ id: "CT-001" }),
      searchParams: Promise.resolve({ returnTo: "/admin/finance" }),
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(
      true,
    );
  });

  it("hands the view the staff name, not the stored login", async () => {
    const element = await CashTransferDetailPage({
      params: Promise.resolve({ id: "CT-001" }),
      searchParams: Promise.resolve({}),
    });
    expect(element.props.transfer.created_by_name).toBe("Tài Chí Tuyền");
  });
});
