import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditProductCategoryPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/products/categories/actions", () => ({
  getCategoriesWithCounts: vi.fn().mockResolvedValue({
    categories: [
      { id: "CAT-001", name: "Cà phê", status: "ACTIVE" },
    ],
    counts: { "CAT-001": 5 },
  }),
  updateCategory: vi.fn(),
  saveCategory: vi.fn(),
}));

vi.mock("@/app/admin/products/categories/components/ProductCategoryForm", () => ({
  ProductCategoryForm: (props: any) => <div data-testid="product-category-form" {...props} />,
}));

describe("EditProductCategoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when category id is unknown", async () => {
    await expect(
      EditProductCategoryPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/products/categories/CAT-001?returnTo=%2Fadmin%2Fproducts%2Fcategories%3Fq%3Dca";
    const element = await EditProductCategoryPage({
      params: { id: "CAT-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/products/categories?q=ca";
    const element = await EditProductCategoryPage({
      params: { id: "CAT-001" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/products/categories/CAT-001?returnTo=" + encodeURIComponent("/admin/products/categories?q=ca"),
    );
  });
});
