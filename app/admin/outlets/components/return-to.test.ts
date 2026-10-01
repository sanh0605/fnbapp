import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo (outlets)", () => {
  it("keeps an outlets list URL", () => {
    expect(safeReturnTo("/admin/outlets")).toBe("/admin/outlets");
    expect(safeReturnTo("/admin/outlets?filter=ACTIVE")).toBe("/admin/outlets?filter=ACTIVE");
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
});
