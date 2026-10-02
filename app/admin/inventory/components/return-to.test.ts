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

  it("accepts detail paths with valid ID, with or without query params", () => {
    expect(safeReturnTo("/admin/inventory/items/SPM-002", "/admin/inventory/items"))
      .toBe("/admin/inventory/items/SPM-002");
    expect(safeReturnTo("/admin/inventory/items/SPM-002?returnTo=%2Fadmin%2Finventory%2Fitems", "/admin/inventory/items"))
      .toBe("/admin/inventory/items/SPM-002?returnTo=%2Fadmin%2Finventory%2Fitems");
    expect(safeReturnTo("/admin/inventory/categories/NHH-001", "/admin/inventory/categories"))
      .toBe("/admin/inventory/categories/NHH-001");
    expect(safeReturnTo("/admin/inventory/units/U-004?tab=info", "/admin/inventory/units"))
      .toBe("/admin/inventory/units/U-004?tab=info");
    expect(safeReturnTo("/admin/inventory/conversions/QD_123", "/admin/inventory/conversions"))
      .toBe("/admin/inventory/conversions/QD_123");
  });

  it("rejects /new and /new with query params, falling back to list", () => {
    expect(safeReturnTo("/admin/inventory/items/new", "/admin/inventory/items"))
      .toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/items/new?returnTo=%2Fadmin%2Finventory%2Fitems", "/admin/inventory/items"))
      .toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/categories/new", "/admin/inventory/categories"))
      .toBe("/admin/inventory/categories");
    expect(safeReturnTo("/admin/inventory/units/new", "/admin/inventory/units"))
      .toBe("/admin/inventory/units");
    expect(safeReturnTo("/admin/inventory/conversions/new", "/admin/inventory/conversions"))
      .toBe("/admin/inventory/conversions");
  });

  it("rejects detail paths for a different list or with invalid id characters", () => {
    expect(safeReturnTo("/admin/inventory/categories/NHH-001", "/admin/inventory/items"))
      .toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/items/SPM-002/edit", "/admin/inventory/items"))
      .toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/items/SPM-002/history", "/admin/inventory/items"))
      .toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/items/SPM 002", "/admin/inventory/items"))
      .toBe("/admin/inventory/items");
    expect(safeReturnTo("/admin/inventory/items/SPM@002", "/admin/inventory/items"))
      .toBe("/admin/inventory/items");
  });
});
