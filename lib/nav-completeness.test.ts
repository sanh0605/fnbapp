import { describe, expect, it } from "vitest";
import { checkNavCompleteness, extractNavHrefs } from "./nav-completeness";

describe("checkNavCompleteness", () => {
  it("passes when every page has a nav entry and every nav entry has a page", () => {
    const result = checkNavCompleteness(
      ["/admin", "/admin/brands"],
      ["/admin", "/admin/brands"],
      [],
    );
    expect(result.ok).toBe(true);
    expect(result.unreachablePages).toEqual([]);
    expect(result.danglingNavEntries).toEqual([]);
  });

  it("fails on a page with no nav entry and no allowlist entry", () => {
    // The first failure mode: a page exists, nothing links to it.
    const result = checkNavCompleteness(
      ["/admin", "/admin/brands", "/admin/orphan"],
      ["/admin", "/admin/brands"],
      [],
    );
    expect(result.ok).toBe(false);
    expect(result.unreachablePages).toEqual(["/admin/orphan"]);
    expect(result.danglingNavEntries).toEqual([]);
  });

  it("passes when an unlinked page is covered by the allowlist", () => {
    const result = checkNavCompleteness(
      ["/admin", "/admin/orphan"],
      ["/admin"],
      [{ route: "/admin/orphan", reason: "section index" }],
    );
    expect(result.ok).toBe(true);
  });

  it("fails on a nav entry with no page behind it -- the second failure mode", () => {
    // The real tree currently has zero cases of this (the plan says so
    // explicitly), so this synthetic fixture is what actually exercises it.
    const result = checkNavCompleteness(
      ["/admin"],
      ["/admin", "/admin/deleted-page"],
      [],
    );
    expect(result.ok).toBe(false);
    expect(result.unreachablePages).toEqual([]);
    expect(result.danglingNavEntries).toEqual(["/admin/deleted-page"]);
  });

  it("fails on both halves at once when both are present", () => {
    const result = checkNavCompleteness(
      ["/admin", "/admin/orphan"],
      ["/admin", "/admin/deleted-page"],
      [],
    );
    expect(result.ok).toBe(false);
    expect(result.unreachablePages).toEqual(["/admin/orphan"]);
    expect(result.danglingNavEntries).toEqual(["/admin/deleted-page"]);
  });
});

describe("extractNavHrefs", () => {
  it("reads href literals out of a navItems-shaped source string", () => {
    const source = `
      const navItems = [
        { name: "Tong quan", href: "/admin", icon: <X /> },
        {
          name: "Danh muc",
          children: [
            { name: "Thuong hieu", href: "/admin/brands" },
            { name: "Diem ban", href: "/admin/outlets" },
          ]
        },
      ];
    `;
    expect(extractNavHrefs(source)).toEqual(["/admin", "/admin/brands", "/admin/outlets"]);
  });

  it("ignores href-shaped strings that are not admin routes", () => {
    const source = `<Link href="/pos">POS</Link> const x = { href: "/admin/real" };`;
    expect(extractNavHrefs(source)).toEqual(["/admin/real"]);
  });
});
