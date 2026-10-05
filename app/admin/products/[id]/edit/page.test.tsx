import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditProductPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/products/load-product-rows", () => ({
  loadProductRows: vi.fn().mockResolvedValue({
    enhancedProducts: [
      {
        id: "PROD-005",
        name: "Matcha latte",
        category_id: "CAT-002",
        status: "ACTIVE",
        variants: [],
        priceHistory: [],
      },
    ],
    activeCategories: [{ id: "CAT-002", name: "Giải trí" }],
  }),
}));

vi.mock("@/app/admin/products/components/ProductForm", () => ({
  default: (props: any) => <div data-testid="product-form" {...props} />,
}));

describe("EditProductPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when product id is unknown", async () => {
    await expect(
      EditProductPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/products/PROD-005?returnTo=%2Fadmin%2Fproducts%3Fstatus%3DINACTIVE";
    const element = await EditProductPage({
      params: { id: "PROD-005" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/products?status=INACTIVE";
    const element = await EditProductPage({
      params: { id: "PROD-005" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/products/PROD-005?returnTo=" + encodeURIComponent("/admin/products?status=INACTIVE"),
    );
  });
});
