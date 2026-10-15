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

const PRODUCT = {
  id: "PROD-005",
  name: "Matcha latte",
  category_id: "CAT-002",
  status: "ACTIVE",
  variants: [],
  priceHistory: [],
};

const { loadProductRow, loadProductRows } = vi.hoisted(() => ({
  loadProductRow: vi.fn(),
  loadProductRows: vi.fn(),
}));
vi.mock("@/app/admin/products/load-product-rows", () => ({ loadProductRow, loadProductRows }));

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn(async (sheet: string) =>
    sheet === "Product_Categories"
      ? [{ id: "CAT-002", name: "Giải trí", status: "ACTIVE" }, { id: "CAT-009", name: "Cũ", status: "DELETED" }]
      : sheet === "Modifier_Groups"
        ? [{ id: "MG-001" }, { id: "MG-002" }]
        : [],
  ),
  findAllWhere: vi.fn(async () => [{ group_id: "MG-001", product_id: "PROD-005" }]),
}));

vi.mock("@/app/admin/products/components/ProductForm", () => ({
  default: (props: any) => <div data-testid="product-form" {...props} />,
}));

describe("EditProductPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadProductRow.mockImplementation(async (id: string) => (id === PRODUCT.id ? PRODUCT : null));
  });

  it("calls notFound when product id is unknown", async () => {
    await expect(
      EditProductPage({ params: Promise.resolve({ id: "UNKNOWN" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("loads the one dish, never the whole list", async () => {
    const element = await EditProductPage({ params: Promise.resolve({ id: "PROD-005" }), searchParams: Promise.resolve({}) });
    const formChild: any = React.Children.toArray(element.props.children).find((c: any) => c.props?.categories);
    expect(loadProductRow).toHaveBeenCalledWith("PROD-005");
    expect(loadProductRows).not.toHaveBeenCalled();
    expect(formChild.props.categories).toEqual([{ id: "CAT-002", name: "Giải trí", status: "ACTIVE" }]);
  });

  it("hands the form the groups and only this dish's ticked ones", async () => {
    const element = await EditProductPage({ params: Promise.resolve({ id: "PROD-005" }), searchParams: Promise.resolve({}) });
    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.selectedOptionGroupIds !== undefined);
    expect(formChild.props.optionGroups).toHaveLength(2);
    expect(formChild.props.selectedOptionGroupIds).toEqual(["MG-001"]);
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/products/PROD-005?returnTo=%2Fadmin%2Fproducts%3Fstatus%3DINACTIVE";
    const element = await EditProductPage({
      params: Promise.resolve({ id: "PROD-005" }),
      searchParams: Promise.resolve({ returnTo }),
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/products?status=INACTIVE";
    const element = await EditProductPage({
      params: Promise.resolve({ id: "PROD-005" }),
      searchParams: Promise.resolve({ returnTo }),
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/products/PROD-005?returnTo=" + encodeURIComponent("/admin/products?status=INACTIVE"),
    );
  });
});
