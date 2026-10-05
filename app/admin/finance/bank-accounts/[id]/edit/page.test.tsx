import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditBankAccountPage from "./page";

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

vi.mock("@/app/admin/finance/bank-accounts/components/BankAccountForm", () => ({
  BankAccountForm: (props: any) => <div data-testid="bank-account-form" {...props} />,
}));

describe("EditBankAccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when account id is unknown", async () => {
    await expect(
      EditBankAccountPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/finance/bank-accounts/BA-001?returnTo=%2Fadmin%2Ffinance%2Fbank-accounts%3Fq%3D1";
    const element = await EditBankAccountPage({
      params: { id: "BA-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/finance/bank-accounts?q=1";
    const element = await EditBankAccountPage({
      params: { id: "BA-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/finance/bank-accounts/BA-001?returnTo=" + encodeURIComponent("/admin/finance/bank-accounts?q=1"),
    );
  });
});
