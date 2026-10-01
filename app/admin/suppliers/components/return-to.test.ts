import { describe, it, expect } from "vitest";
import { safeReturnTo, safePoReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps a suppliers list URL with filters", () => {
    expect(safeReturnTo("/admin/suppliers?q=C%C3%A0%20ph%C3%AA&status=ACTIVE"))
      .toBe("/admin/suppliers?q=C%C3%A0%20ph%C3%AA&status=ACTIVE");
  });
  it("keeps a suppliers detail URL with query params", () => {
    expect(
      safeReturnTo("/admin/suppliers/NCC-029?returnTo=%2Fadmin%2Fsuppliers%3Fq%3Dvina")
    ).toBe("/admin/suppliers/NCC-029?returnTo=%2Fadmin%2Fsuppliers%3Fq%3Dvina");
  });
  it("falls back to suppliers list for /admin/suppliers/new", () => {
    expect(safeReturnTo("/admin/suppliers/new")).toBe("/admin/suppliers");
  });
  it("falls back for a missing value", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/suppliers");
    expect(safeReturnTo("")).toBe("/admin/suppliers");
  });
  it("falls back for an outside or other-screen URL", () => {
    expect(safeReturnTo("https://x.com")).toBe("/admin/suppliers");
    expect(safeReturnTo("https://evil.example")).toBe("/admin/suppliers");
    expect(safeReturnTo("//evil.example/admin/suppliers")).toBe("/admin/suppliers");
    expect(safeReturnTo("/admin/users")).toBe("/admin/suppliers");
    expect(safeReturnTo("/admin/suppliersX")).toBe("/admin/suppliers");
  });
});

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

