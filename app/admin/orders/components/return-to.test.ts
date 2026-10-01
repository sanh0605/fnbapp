import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps an orders list URL with filters", () => {
    expect(safeReturnTo("/admin/orders?q=ORD-001&payment=Tien%20mat"))
      .toBe("/admin/orders?q=ORD-001&payment=Tien%20mat");
  });
  it("falls back for a missing value", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/orders");
    expect(safeReturnTo("")).toBe("/admin/orders");
  });
  it("falls back for an outside or other-screen URL", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/admin/orders");
    expect(safeReturnTo("//evil.example/admin/orders")).toBe("/admin/orders");
    expect(safeReturnTo("/admin/users")).toBe("/admin/orders");
    expect(safeReturnTo("/admin/ordersX")).toBe("/admin/orders");
  });
});
