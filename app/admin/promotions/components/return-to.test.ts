import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo (promotions)", () => {
  it("keeps a promotions list URL with filters", () => {
    expect(safeReturnTo("/admin/promotions?status=ACTIVE"))
      .toBe("/admin/promotions?status=ACTIVE");
    expect(safeReturnTo("/admin/promotions?type=ORDER_DISCOUNT&q=SALE"))
      .toBe("/admin/promotions?type=ORDER_DISCOUNT&q=SALE");
    expect(safeReturnTo("/admin/promotions"))
      .toBe("/admin/promotions");
  });

  it("falls back for a missing value", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/promotions");
    expect(safeReturnTo("")).toBe("/admin/promotions");
    expect(safeReturnTo(null)).toBe("/admin/promotions");
  });

  it("falls back for an outside or other-screen URL", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/admin/promotions");
    expect(safeReturnTo("//evil.example/admin/promotions")).toBe("/admin/promotions");
    expect(safeReturnTo("/admin/users")).toBe("/admin/promotions");
    expect(safeReturnTo("/admin/promotionsX")).toBe("/admin/promotions");
  });

  it("accepts valid detail path inside list and refuses 'new'", () => {
    expect(safeReturnTo("/admin/promotions/PRM-004?returnTo=x"))
      .toBe("/admin/promotions/PRM-004?returnTo=x");
    expect(safeReturnTo("/admin/promotions/PRM-001"))
      .toBe("/admin/promotions/PRM-001");
    expect(safeReturnTo("/admin/promotions/new"))
      .toBe("/admin/promotions");
    expect(safeReturnTo("/admin/promotions/new?returnTo=x"))
      .toBe("/admin/promotions");
  });
});
