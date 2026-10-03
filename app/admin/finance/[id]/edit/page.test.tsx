import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditCashEntryPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/db/tables", () => ({
  findById: vi.fn().mockImplementation((table: string, id: string) => {
    if (id === "CE-001") {
      return Promise.resolve({
        id: "CE-001",
        category_id: "CFC-001",
        amount: 150000,
        status: "ACTIVE",
      });
    }
    if (id === "CE-CANCELLED") {
      return Promise.resolve({
        id: "CE-CANCELLED",
        category_id: "CFC-001",
        amount: 150000,
        status: "CANCELLED",
      });
    }
    return Promise.resolve(null);
  }),
}));

vi.mock("@/app/admin/finance/categories/actions", () => ({
  getCashCategories: vi.fn().mockResolvedValue([
    { id: "CFC-001", name: "Vận hành" },
  ]),
}));

vi.mock("@/app/admin/finance/bank-accounts/actions", () => ({
  getBankAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/admin/finance/components/CashEntryForm", () => ({
  CashEntryForm: (props: any) => <div data-testid="cash-entry-form" {...props} />,
}));

describe("EditCashEntryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when entry id is unknown", async () => {
    await expect(
      EditCashEntryPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("calls notFound when entry is cancelled", async () => {
    await expect(
      EditCashEntryPage({ params: { id: "CE-CANCELLED" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/finance/CE-001?returnTo=%2Fadmin%2Ffinance%3Fpreset%3DTHIS_MONTH";
    const element = await EditCashEntryPage({
      params: { id: "CE-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/finance?preset=THIS_MONTH";
    const element = await EditCashEntryPage({
      params: { id: "CE-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/finance/CE-001?returnTo=" + encodeURIComponent("/admin/finance?preset=THIS_MONTH"),
    );
  });
});
