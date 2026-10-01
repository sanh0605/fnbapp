import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps a finance list URL with query params", () => {
    expect(safeReturnTo("/admin/finance?preset=LAST_MONTH", "/admin/finance"))
      .toBe("/admin/finance?preset=LAST_MONTH");
    expect(safeReturnTo("/admin/finance", "/admin/finance"))
      .toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/bank-accounts?x=1", "/admin/finance/bank-accounts"))
      .toBe("/admin/finance/bank-accounts?x=1");
  });

  it("falls back for missing or empty value", () => {
    expect(safeReturnTo(undefined, "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo(null, "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("", "/admin/finance")).toBe("/admin/finance");
  });

  it("falls back for a different screen", () => {
    expect(safeReturnTo("/admin/finance/categories", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance", "/admin/finance/categories")).toBe("/admin/finance/categories");
  });

  it("falls back for an outside or off-site URL", () => {
    expect(safeReturnTo("https://evil.example", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("//evil.example", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/financeX", "/admin/finance")).toBe("/admin/finance");
  });
});
