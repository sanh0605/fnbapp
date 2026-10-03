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

  it("accepts valid record detail paths optionally followed by query params", () => {
    expect(safeReturnTo("/admin/finance/CE-001", "/admin/finance"))
      .toBe("/admin/finance/CE-001");
    expect(safeReturnTo("/admin/finance/CE-040?preset=THIS_MONTH", "/admin/finance"))
      .toBe("/admin/finance/CE-040?preset=THIS_MONTH");
    expect(safeReturnTo("/admin/finance/categories/CFC-001", "/admin/finance/categories"))
      .toBe("/admin/finance/categories/CFC-001");
    expect(safeReturnTo("/admin/finance/categories/CFC-001?returnTo=%2Fadmin%2Ffinance%2Fcategories", "/admin/finance/categories"))
      .toBe("/admin/finance/categories/CFC-001?returnTo=%2Fadmin%2Ffinance%2Fcategories");
    expect(safeReturnTo("/admin/finance/bank-accounts/BA-001", "/admin/finance/bank-accounts"))
      .toBe("/admin/finance/bank-accounts/BA-001");
    expect(safeReturnTo("/admin/finance/bank-accounts/BA-001?foo=bar", "/admin/finance/bank-accounts"))
      .toBe("/admin/finance/bank-accounts/BA-001?foo=bar");
  });

  it("refuses 'new' as a record detail path", () => {
    expect(safeReturnTo("/admin/finance/new", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/new?preset=THIS_MONTH", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/categories/new", "/admin/finance/categories")).toBe("/admin/finance/categories");
    expect(safeReturnTo("/admin/finance/bank-accounts/new", "/admin/finance/bank-accounts")).toBe("/admin/finance/bank-accounts");
  });

  it("refuses 'categories' and 'bank-accounts' as cash entry details under /admin/finance", () => {
    expect(safeReturnTo("/admin/finance/categories", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/categories?q=test", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/bank-accounts", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/bank-accounts?x=1", "/admin/finance")).toBe("/admin/finance");
  });

  it("accepts /admin/finance/categories when list is /admin/finance/categories", () => {
    expect(safeReturnTo("/admin/finance/categories", "/admin/finance/categories"))
      .toBe("/admin/finance/categories");
    expect(safeReturnTo("/admin/finance/categories?status=ALL", "/admin/finance/categories"))
      .toBe("/admin/finance/categories?status=ALL");
  });

  it("refuses other lists' detail paths and nested paths like /edit", () => {
    expect(safeReturnTo("/admin/finance/categories/CFC-001", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/bank-accounts/BA-001", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/CE-001/edit", "/admin/finance")).toBe("/admin/finance");
    expect(safeReturnTo("/admin/finance/CE@001", "/admin/finance")).toBe("/admin/finance");
  });
});
