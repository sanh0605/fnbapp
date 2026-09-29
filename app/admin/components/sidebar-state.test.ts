import { describe, expect, it } from "vitest";
import { activeChildHref, activeGroupName, readSidebarCollapsed, writeSidebarCollapsed } from "./sidebar-state";

describe("sidebar state", () => {
  it("reads collapsed only from the exact stored value", () => {
    expect(readSidebarCollapsed(() => ({ getItem: () => "1" }))).toBe(true);
    expect(readSidebarCollapsed(() => ({ getItem: () => "0" }))).toBe(false);
    expect(readSidebarCollapsed(() => ({ getItem: () => "garbage" }))).toBe(false);
    expect(readSidebarCollapsed(() => null)).toBe(false);
  });
  it("never throws when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } };
    expect(readSidebarCollapsed(() => blocked)).toBe(false);
    expect(() => writeSidebarCollapsed(() => blocked, true)).not.toThrow();
  });
  describe("activeChildHref", () => {
    it("returns the longest matching child href", () => {
      const children1 = [{ href: '/admin/products' }, { href: '/admin/products/categories' }];
      expect(activeChildHref('/admin/products/categories', children1)).toBe('/admin/products/categories');
      expect(activeChildHref('/admin/products', children1)).toBe('/admin/products');
      expect(activeChildHref('/admin/products/abc123/edit', children1)).toBe('/admin/products');

      const children2 = [{ href: '/admin/finance' }, { href: '/admin/finance/categories' }, { href: '/admin/finance/bank-accounts' }];
      expect(activeChildHref('/admin/finance/categories', children2)).toBe('/admin/finance/categories');

      const children3 = [{ href: '/admin/finance' }];
      expect(activeChildHref('/admin/orders', children3)).toBe(null);
    });
  });

  it("finds the group of the current page by the longest matching link", () => {
    expect(activeGroupName("/admin/inventory/purchase-orders/PO-191")).toBe("Nhập hàng");
    expect(activeGroupName("/admin/products/categories")).toBe("Bán hàng");
    expect(activeGroupName("/admin/inventory/conversions")).toBe(null);
    expect(activeGroupName("/admin")).toBe("Tổng quan");
  });
});
