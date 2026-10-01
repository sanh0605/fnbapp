import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps a suppliers list URL with filters", () => {
    expect(safeReturnTo("/admin/suppliers?q=C%C3%A0%20ph%C3%AA&status=ACTIVE"))
      .toBe("/admin/suppliers?q=C%C3%A0%20ph%C3%AA&status=ACTIVE");
  });
  it("falls back for a missing value", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/suppliers");
    expect(safeReturnTo("")).toBe("/admin/suppliers");
  });
  it("falls back for an outside or other-screen URL", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/admin/suppliers");
    expect(safeReturnTo("//evil.example/admin/suppliers")).toBe("/admin/suppliers");
    expect(safeReturnTo("/admin/users")).toBe("/admin/suppliers");
    expect(safeReturnTo("/admin/suppliersX")).toBe("/admin/suppliers");
  });
});
