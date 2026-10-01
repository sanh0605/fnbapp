import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo (promotions)", () => {
  it("keeps a promotions list URL with filters", () => {
    expect(safeReturnTo("/admin/promotions?status=ACTIVE"))
      .toBe("/admin/promotions?status=ACTIVE");
    expect(safeReturnTo("/admin/promotions?type=ORDER_DISCOUNT&q=SALE"))
      .toBe("/admin/promotions?type=ORDER_DISCOUNT&q=SALE");
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
});
