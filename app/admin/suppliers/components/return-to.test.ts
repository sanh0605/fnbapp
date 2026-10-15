import { describe, it, expect } from "vitest";
import { safePoReturnTo } from "./return-to";

describe("safePoReturnTo", () => {
  it("keeps purchase order new URL with draft=1", () => {
    expect(safePoReturnTo("/admin/inventory/purchase-orders/new?draft=1"))
      .toBe("/admin/inventory/purchase-orders/new?draft=1");
  });
  it("keeps purchase order edit URL with draft=1", () => {
    expect(safePoReturnTo("/admin/inventory/purchase-orders/PO-7?edit=1&draft=1"))
      .toBe("/admin/inventory/purchase-orders/PO-7?edit=1&draft=1");
  });
  it("falls back to default PO URL for missing, outside, or other-screen URLs", () => {
    expect(safePoReturnTo("https://x.com")).toBe("/admin/inventory/purchase-orders/new?draft=1");
    expect(safePoReturnTo("//x.com")).toBe("/admin/inventory/purchase-orders/new?draft=1");
    expect(safePoReturnTo("/admin/suppliers")).toBe("/admin/inventory/purchase-orders/new?draft=1");
    expect(safePoReturnTo(undefined)).toBe("/admin/inventory/purchase-orders/new?draft=1");
    expect(safePoReturnTo("")).toBe("/admin/inventory/purchase-orders/new?draft=1");
  });
});

