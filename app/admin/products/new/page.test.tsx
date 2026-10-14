import { describe, it, expect, vi } from "vitest";
import React from "react";
import NewProductPage from "./page";

const { loadProductRows } = vi.hoisted(() => ({ loadProductRows: vi.fn() }));
vi.mock("@/app/admin/products/load-product-rows", () => ({ loadProductRows }));
vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn(async (sheet: string) =>
    sheet === "Product_Categories"
      ? [{ id: "CAT-002", name: "Giải trí", status: "ACTIVE" }, { id: "CAT-009", name: "Cũ", status: "DELETED" }]
      : [{ id: "MG-001" }],
  ),
}));
vi.mock("@/app/admin/products/components/ProductForm", () => ({ default: () => null }));

describe("NewProductPage", () => {
  it("loads only the groups and categories the form needs, not every dish", async () => {
    const element: any = await NewProductPage({ searchParams: {} });
    const form: any = React.Children.toArray(element.props.children).find((c: any) => c.props?.categories);
    expect(loadProductRows).not.toHaveBeenCalled();
    expect(form.props.categories).toEqual([{ id: "CAT-002", name: "Giải trí", status: "ACTIVE" }]);
    expect(form.props.optionGroups).toEqual([{ id: "MG-001" }]);
  });
});
