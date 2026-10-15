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

const { findAllWhereMock } = vi.hoisted(() => ({ findAllWhereMock: vi.fn() }));
vi.mock("@/lib/db/tables", () => ({ findAllWhere: findAllWhereMock }));

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
    findAllWhereMock.mockResolvedValue([]);
  });

  // The form locks Thu/Chi once any row (any status) uses the group; one row is enough to know.
  it("asks for one linked hand row, not the whole ledger, to lock the side", async () => {
    findAllWhereMock.mockResolvedValue([{ id: "CE-001" }]);
    const element = await EditCashCategoryPage({
      params: Promise.resolve({ id: "CFC-001" }),
      searchParams: Promise.resolve({}),
    });
    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild.props.hasEntries).toBe(true);
    expect(findAllWhereMock).toHaveBeenCalledWith("Cash_Entries", { eq: { category_id: "CFC-001" }, limit: 1 });
  });

  it("calls notFound when category id is unknown", async () => {
    await expect(
      EditCashCategoryPage({ params: Promise.resolve({ id: "UNKNOWN" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/finance/categories/CFC-001?returnTo=%2Fadmin%2Ffinance%2Fcategories%3Fq%3D1";
    const element = await EditCashCategoryPage({
      params: Promise.resolve({ id: "CFC-001" }),
      searchParams: Promise.resolve({ returnTo }),
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/finance/categories?q=1";
    const element = await EditCashCategoryPage({
      params: Promise.resolve({ id: "CFC-001" }),
      searchParams: Promise.resolve({ returnTo }),
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/finance/categories/CFC-001?returnTo=" + encodeURIComponent("/admin/finance/categories?q=1"),
    );
  });
});
