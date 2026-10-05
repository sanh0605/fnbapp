import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo (users)", () => {
  it("keeps a users list URL with filters", () => {
    expect(safeReturnTo("/admin/users")).toBe("/admin/users");
    expect(safeReturnTo("/admin/users?role=STAFF")).toBe("/admin/users?role=STAFF");
    expect(safeReturnTo("/admin/users?q=admin&role=ADMIN"))
      .toBe("/admin/users?q=admin&role=ADMIN");
  });

  it("falls back for a missing value", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/users");
    expect(safeReturnTo("")).toBe("/admin/users");
    expect(safeReturnTo(null)).toBe("/admin/users");
  });

  it("falls back for an outside or other-screen URL", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/admin/users");
    expect(safeReturnTo("//evil.example/admin/users")).toBe("/admin/users");
    expect(safeReturnTo("/admin/suppliers")).toBe("/admin/users");
    expect(safeReturnTo("/admin/usersX")).toBe("/admin/users");
  });

  it("accepts valid detail path inside list and refuses 'new'", () => {
    expect(safeReturnTo("/admin/users/USR-001")).toBe("/admin/users/USR-001");
    expect(safeReturnTo("/admin/users/USR-002?returnTo=%2Fadmin%2Fusers"))
      .toBe("/admin/users/USR-002?returnTo=%2Fadmin%2Fusers");
    expect(safeReturnTo("/admin/users/new")).toBe("/admin/users");
    expect(safeReturnTo("/admin/users/new?returnTo=%2Fadmin%2Fusers")).toBe("/admin/users");
  });

  it("refuses edit routes and other invalid subpaths", () => {
    expect(safeReturnTo("/admin/users/USR-002/edit")).toBe("/admin/users");
    expect(safeReturnTo("/admin/users/USR-002/edit?returnTo=%2Fadmin%2Fusers")).toBe("/admin/users");
    expect(safeReturnTo("/admin/users/")).toBe("/admin/users");
    expect(safeReturnTo("//evil")).toBe("/admin/users");
  });
});
