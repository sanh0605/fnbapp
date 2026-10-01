import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps an inventory list URL with query params", () => {
    expect(safeReturnTo("/admin/inventory/items?category=CAT-1", "/admin/inventory/items"))
      .toBe("/admin/inventory/items?category=CAT-1");
    expect(safeReturnTo("/admin/inventory/items", "/admin/inventory/items"))
      .toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/conversions?q=abc", "/admin/inventory/conversions"))
      .toBe("/admin/inventory/conversions?q=abc");
    expect(safeReturnTo("/admin/inventory/assets?tab=DISPOSED", "/admin/inventory/assets"))
      .toBe("/admin/inventory/assets?tab=DISPOSED");
  });

  it("falls back for missing or empty value", () => {
    expect(safeReturnTo(undefined, "/admin/inventory/items")).toBe("/admin/inventory/items");
    expect(safeReturnTo(null, "/admin/inventory/items")).toBe("/admin/inventory/items");
    expect(safeReturnTo("", "/admin/inventory/items")).toBe("/admin/inventory/items");
  });

  it("falls back for a different screen", () => {
    expect(safeReturnTo("/admin/inventory/categories", "/admin/inventory/items")).toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/items", "/admin/inventory/categories")).toBe("/admin/inventory/categories");
    expect(safeReturnTo("/admin/inventory/asset-bands", "/admin/inventory/assets")).toBe("/admin/inventory/assets");
  });

  it("falls back for an outside or off-site URL", () => {
    expect(safeReturnTo("https://evil.example", "/admin/inventory/items")).toBe("/admin/inventory/items");
    expect(safeReturnTo("//evil.example", "/admin/inventory/items")).toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/itemsX", "/admin/inventory/items")).toBe("/admin/inventory/items");
  });
});
