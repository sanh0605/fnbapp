import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo (outlets)", () => {
  it("keeps an outlets list URL", () => {
    expect(safeReturnTo("/admin/outlets")).toBe("/admin/outlets");
    expect(safeReturnTo("/admin/outlets?status=INACTIVE")).toBe("/admin/outlets?status=INACTIVE");
  });

  it("falls back for a missing value", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/outlets");
    expect(safeReturnTo("")).toBe("/admin/outlets");
    expect(safeReturnTo(null)).toBe("/admin/outlets");
  });

  it("falls back for an outside or other-screen URL", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/admin/outlets");
    expect(safeReturnTo("//evil.example/admin/outlets")).toBe("/admin/outlets");
    expect(safeReturnTo("/admin/users")).toBe("/admin/outlets");
    expect(safeReturnTo("/admin/outletsX")).toBe("/admin/outlets");
  });

  it("accepts valid detail path inside list and refuses 'new'", () => {
    expect(safeReturnTo("/admin/outlets/OUT-001?returnTo=x"))
      .toBe("/admin/outlets/OUT-001?returnTo=x");
    expect(safeReturnTo("/admin/outlets/OUT-002"))
      .toBe("/admin/outlets/OUT-002");
    expect(safeReturnTo("/admin/outlets/new"))
      .toBe("/admin/outlets");
    expect(safeReturnTo("/admin/outlets/new?returnTo=x"))
      .toBe("/admin/outlets");
  });
});
