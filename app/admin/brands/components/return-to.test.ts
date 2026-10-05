import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo (brands)", () => {
  it("keeps a brands list URL", () => {
    expect(safeReturnTo("/admin/brands")).toBe("/admin/brands");
    expect(safeReturnTo("/admin/brands?q=ABC")).toBe("/admin/brands?q=ABC");
  });

  it("falls back for a missing value", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/brands");
    expect(safeReturnTo("")).toBe("/admin/brands");
    expect(safeReturnTo(null)).toBe("/admin/brands");
  });

  it("falls back for an outside or other-screen URL", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/admin/brands");
    expect(safeReturnTo("//evil.example/admin/brands")).toBe("/admin/brands");
    expect(safeReturnTo("/admin/users")).toBe("/admin/brands");
    expect(safeReturnTo("/admin/brandsX")).toBe("/admin/brands");
  });

  it("accepts valid detail path inside list and refuses 'new'", () => {
    expect(safeReturnTo("/admin/brands/BR-001?returnTo=x"))
      .toBe("/admin/brands/BR-001?returnTo=x");
    expect(safeReturnTo("/admin/brands/BR-002"))
      .toBe("/admin/brands/BR-002");
    expect(safeReturnTo("/admin/brands/new"))
      .toBe("/admin/brands");
    expect(safeReturnTo("/admin/brands/new?returnTo=x"))
      .toBe("/admin/brands");
  });
});
