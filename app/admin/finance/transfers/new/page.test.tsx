import { describe, it, expect, vi, beforeEach } from "vitest";
import NewCashTransferPage from "./page";

vi.mock("@/app/admin/finance/bank-accounts/actions", () => ({
  getBankAccounts: vi.fn().mockResolvedValue([
    {
      id: "BA-001",
      name: "ACB - Phin Di",
      bank_name: "ACB",
      account_number: "123456",
      status: "ACTIVE",
    },
  ]),
}));

describe("NewCashTransferPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await NewCashTransferPage({
      searchParams: { returnTo: "/admin/finance" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(
      true,
    );
  });
});
