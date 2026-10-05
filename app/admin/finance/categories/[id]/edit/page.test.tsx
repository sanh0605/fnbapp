import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditCashCategoryPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockImplementation((table: string) => {
    if (table === "Cash_Entries") return Promise.resolve([]);
    return Promise.resolve([]);
  }),
}));

vi.mock("@/app/admin/finance/categories/actions", () => ({
  getCashCategories: vi.fn().mockResolvedValue([
    { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
  ]),
}));

vi.mock("@/app/admin/finance/categories/components/CategoryForm", () => ({
  CategoryForm: (props: any) => <div data-testid="category-form" {...props} />,
}));

describe("EditCashCategoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when category id is unknown", async () => {
    await expect(
      EditCashCategoryPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/finance/categories/CFC-001?returnTo=%2Fadmin%2Ffinance%2Fcategories%3Fq%3D1";
    const element = await EditCashCategoryPage({
      params: { id: "CFC-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/finance/categories?q=1";
    const element = await EditCashCategoryPage({
      params: { id: "CFC-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/finance/categories/CFC-001?returnTo=" + encodeURIComponent("/admin/finance/categories?q=1"),
    );
  });
});
