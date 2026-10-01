import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps a products list URL with query params", () => {
    expect(safeReturnTo("/admin/products?status=INACTIVE", "/admin/products"))
      .toBe("/admin/products?status=INACTIVE");
    expect(safeReturnTo("/admin/products", "/admin/products"))
      .toBe("/admin/products");
    expect(safeReturnTo("/admin/products/categories?q=tra", "/admin/products/categories"))
      .toBe("/admin/products/categories?q=tra");
    expect(safeReturnTo("/admin/products/modifiers?q=topping", "/admin/products/modifiers"))
      .toBe("/admin/products/modifiers?q=topping");
  });

  it("falls back for missing or empty value", () => {
    expect(safeReturnTo(undefined, "/admin/products")).toBe("/admin/products");
    expect(safeReturnTo(null, "/admin/products")).toBe("/admin/products");
    expect(safeReturnTo("", "/admin/products")).toBe("/admin/products");
  });

  it("falls back for a different screen", () => {
    expect(safeReturnTo("/admin/products/categories", "/admin/products")).toBe("/admin/products");
    expect(safeReturnTo("/admin/products", "/admin/products/categories")).toBe("/admin/products/categories");
    expect(safeReturnTo("/admin/products/modifiers", "/admin/products")).toBe("/admin/products");
  });

  it("falls back for an outside or off-site URL", () => {
    expect(safeReturnTo("https://evil.example", "/admin/products")).toBe("/admin/products");
    expect(safeReturnTo("//evil.example", "/admin/products")).toBe("/admin/products");
    expect(safeReturnTo("/admin/productsX", "/admin/products")).toBe("/admin/products");
  });
});
