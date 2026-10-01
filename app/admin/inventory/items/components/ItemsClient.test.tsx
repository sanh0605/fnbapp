// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ItemsClient from "./ItemsClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/admin/inventory/items",
  useSearchParams: () => new URLSearchParams("category=CAT-1"),
}));

vi.mock("@/lib/shared/use-filter-form", () => ({
  useFilterForm: () => ({
    draft: { q: "", category: "CAT-1" },
    setField: vi.fn(),
    applyFilters: vi.fn(),
    isPending: false,
  }),
}));

const CATEGORIES = [
  { id: "CAT-1", name: "Nguyên liệu", system_type: "RAW" },
] as any;

const ITEMS = [
  {
    id: "ITEM-001",
    name: "Cà phê Robusta",
    item_category_id: "CAT-1",
  },
] as any;

describe("ItemsClient links with returnTo", () => {
  it("renders Sửa and Lịch sử nhập links with returnTo encoding current path and params", () => {
    render(
      <ItemsClient
        categories={CATEGORIES}
        items={ITEMS}
        conversions={[]}
        units={[]}
        unitLockedItemIds={[]}
        canDelete={false}
      />,
    );

    const expectedReturnTo = encodeURIComponent("/admin/inventory/items?category=CAT-1");

    // Check '+ Thêm Hàng Mua Vào' link
    const addLink = screen.getByRole("link", { name: "+ Thêm Hàng Mua Vào" });
    expect(addLink).toHaveAttribute(
      "href",
      `/admin/inventory/items/new?returnTo=${expectedReturnTo}`,
    );

    // Check 'Sửa' links (desktop and mobile)
    const editLinks = screen.getAllByRole("link", { name: "Sửa" });
    expect(editLinks[0]).toHaveAttribute(
      "href",
      `/admin/inventory/items/ITEM-001/edit?returnTo=${expectedReturnTo}`,
    );

    // Check 'Lịch sử nhập' links (desktop and mobile)
    const historyLinks = screen.getAllByRole("link", { name: "Lịch sử nhập" });
    expect(historyLinks[0]).toHaveAttribute(
      "href",
      `/admin/inventory/items/ITEM-001/history?returnTo=${expectedReturnTo}`,
    );
  });
});
