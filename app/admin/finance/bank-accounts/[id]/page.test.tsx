import { describe, it, expect, vi, beforeEach } from "vitest";
import BankAccountDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/finance/bank-accounts/actions", () => ({
  getBankAccounts: vi.fn().mockResolvedValue([
    { id: "BA-001", name: "ACB - Phin Di", status: "ACTIVE" },
  ]),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "usr-1", name: "Chủ quán", role: "ADMIN" },
  }),
}));

describe("BankAccountDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when account id is unknown", async () => {
    await expect(
      BankAccountDetailPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await BankAccountDetailPage({
      params: { id: "BA-001" },
      searchParams: { returnTo: "/admin/finance/bank-accounts" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
