import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

const F = "/admin/finance";

describe("safeReturnTo", () => {
  it("keeps the list, with or without a query", () => {
    expect(safeReturnTo(`${F}?preset=LAST_MONTH`, F)).toBe(`${F}?preset=LAST_MONTH`);
    expect(safeReturnTo(F, F)).toBe(F);
    expect(safeReturnTo("/admin/brands?q=x", "/admin/brands")).toBe("/admin/brands?q=x");
  });

  it("falls back to the list for empty values", () => {
    for (const v of [undefined, null, ""]) expect(safeReturnTo(v, F)).toBe(F);
  });

  it("falls back for off-site, other-screen and prefix-lookalike paths", () => {
    expect(safeReturnTo("https://evil.example", F)).toBe(F);
    expect(safeReturnTo("//evil.example", F)).toBe(F);
    expect(safeReturnTo("/admin/financeX", F)).toBe(F);
    expect(safeReturnTo("/admin/users", F)).toBe(F);
    expect(safeReturnTo("/admin/ordersX", "/admin/orders")).toBe("/admin/orders");
    expect(safeReturnTo(`${F}/categories`, "/admin/inventory/items")).toBe("/admin/inventory/items");
  });

  it("accepts <list>/<id> with an optional query, refuses new, nested and odd ids", () => {
    expect(safeReturnTo(`${F}/CE-001`, F)).toBe(`${F}/CE-001`);
    expect(safeReturnTo(`${F}/CE-040?preset=THIS_MONTH`, F)).toBe(`${F}/CE-040?preset=THIS_MONTH`);
    expect(safeReturnTo(`${F}/bank-accounts/BA-1?foo=bar`, `${F}/bank-accounts`)).toBe(`${F}/bank-accounts/BA-1?foo=bar`);
    expect(safeReturnTo(`${F}/new`, F)).toBe(F);
    expect(safeReturnTo(`${F}/new?x=1`, F)).toBe(F);
    expect(safeReturnTo(`${F}/CE-001/edit`, F)).toBe(F);
    expect(safeReturnTo(`${F}/CE@001`, F)).toBe(F);
  });

  it("finance list does not take the finance sub-lists as record ids", () => {
    for (const p of ["categories", "bank-accounts"]) {
      expect(safeReturnTo(`${F}/${p}`, F)).toBe(F);
      expect(safeReturnTo(`${F}/${p}?q=1`, F)).toBe(F);
    }
    expect(safeReturnTo(`${F}/categories?s=ALL`, `${F}/categories`)).toBe(`${F}/categories?s=ALL`);
  });

  it("products list does not take categories or modifiers as record ids", () => {
    const P = "/admin/products";
    expect(safeReturnTo(`${P}/categories`, P)).toBe(P);
    expect(safeReturnTo(`${P}/modifiers/MOD-1`, P)).toBe(P);
    expect(safeReturnTo(`${P}/SP-1`, P)).toBe(`${P}/SP-1`);
    expect(safeReturnTo(`${P}/modifiers/MOD-1`, `${P}/modifiers`)).toBe(`${P}/modifiers/MOD-1`);
  });

  it("accepts exactly /admin for finance screens only", () => {
    expect(safeReturnTo("/admin", F)).toBe("/admin");
    expect(safeReturnTo("/admin", `${F}/categories`)).toBe("/admin");
    expect(safeReturnTo("/admin?x=1", F)).toBe(F);
    expect(safeReturnTo("/admin", "/admin/brands")).toBe("/admin/brands");
  });

  it("opts.detail adds another base for record paths (cash transfers)", () => {
    const o = { detail: [`${F}/transfers`] };
    expect(safeReturnTo(`${F}/transfers/TRF-1?x=1`, F, o)).toBe(`${F}/transfers/TRF-1?x=1`);
    expect(safeReturnTo(`${F}/transfers/new`, F, o)).toBe(F);
    expect(safeReturnTo(`${F}/transfers/TRF-1/edit`, F, o)).toBe(F);
  });

  it("opts.listOnly refuses record paths (orders)", () => {
    expect(safeReturnTo("/admin/orders?q=ORD-001", "/admin/orders", { listOnly: true })).toBe("/admin/orders?q=ORD-001");
    expect(safeReturnTo("/admin/orders/ORD-001", "/admin/orders", { listOnly: true })).toBe("/admin/orders");
  });
});
