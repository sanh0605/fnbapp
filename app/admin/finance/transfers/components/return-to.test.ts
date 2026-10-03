import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

describe("transfers safeReturnTo", () => {
  it("defaults to fallback when undefined, null, or empty", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/finance");
    expect(safeReturnTo(null)).toBe("/admin/finance");
    expect(safeReturnTo("")).toBe("/admin/finance");
    expect(safeReturnTo("", "/admin/finance/transfers/CT-001")).toBe(
      "/admin/finance/transfers/CT-001",
    );
  });

  it("accepts /admin/finance with and without query parameters", () => {
    expect(safeReturnTo("/admin/finance")).toBe("/admin/finance");
    expect(
      safeReturnTo("/admin/finance?preset=THIS_MONTH&status=ACTIVE"),
    ).toBe("/admin/finance?preset=THIS_MONTH&status=ACTIVE");
  });

  it("accepts transfer detail path with or without query", () => {
    expect(safeReturnTo("/admin/finance/transfers/CT-001")).toBe(
      "/admin/finance/transfers/CT-001",
    );
    expect(
      safeReturnTo(
        "/admin/finance/transfers/CT-001?returnTo=%2Fadmin%2Ffinance",
      ),
    ).toBe("/admin/finance/transfers/CT-001?returnTo=%2Fadmin%2Ffinance");
  });

  it("refuses /admin/finance/transfers/new", () => {
    expect(safeReturnTo("/admin/finance/transfers/new")).toBe("/admin/finance");
    expect(
      safeReturnTo(
        "/admin/finance/transfers/new?returnTo=%2Fadmin%2Ffinance",
        "/fallback",
      ),
    ).toBe("/fallback");
  });

  it("refuses off-site or foreign routes", () => {
    expect(safeReturnTo("https://evil.com")).toBe("/admin/finance");
    expect(safeReturnTo("//evil.com")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/orders")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/users")).toBe("/admin/finance");
  });
});
