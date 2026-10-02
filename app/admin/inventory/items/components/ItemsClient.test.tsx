// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import ItemsClient from "./ItemsClient";
import type { DBPurchasedItem, DBItemCategory, DBUOMConversion, DBUnit } from "@/types/db";

const { replace, refresh, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, push: pushFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/inventory/items",
  useSearchParams: () => new URLSearchParams("category=CAT-1"),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../actions", () => ({
  deletePurchasedItemAction: vi.fn(),
}));

const CATEGORIES: DBItemCategory[] = [
  { id: "CAT-1", name: "Nguyên liệu", system_type: "RAW", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "CAT-2", name: "Vật tư", system_type: "CONSUMABLE", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
];

const ITEMS: DBPurchasedItem[] = [
  {
    id: "SPM-002",
    name: "Sữa tươi Mlekovita",
    item_category_id: "CAT-1",
    default_unit_id: "UNT-ML",
    status: "ACTIVE",
    is_non_inventory: false,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "SPM-003",
    name: "Cà phê Robusta",
    item_category_id: "CAT-1",
    default_unit_id: "UNT-G",
    status: "ACTIVE",
    is_non_inventory: false,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const CONVERSIONS: DBUOMConversion[] = [
  {
    id: "QD-1",
    purchased_item_id: "SPM-002",
    from_unit_id: "UNT-HOP",
    to_unit_id: "UNT-ML",
    factor: "1000",
    purchased_unit: "Hộp",
    conversion_rate: "1000",
    base_unit: "ml",
    status: "ACTIVE",
    purchase_only: false,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const UNITS: DBUnit[] = [
  { id: "UNT-ML", name: "ml", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "UNT-HOP", name: "Hộp", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  push.mockClear();
});

describe("ItemsClient", () => {
  it("renders row linking to detail page instead of removed Sửa and Lịch sử nhập links", () => {
    render(
      <ItemsClient
        categories={CATEGORIES}
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        unitLockedItemIds={[]}
        canDelete={false}
      />,
    );

    // Old buttons must NOT be rendered
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Lịch sử nhập" })).toBeNull();
    expect(screen.queryByText("Sửa")).toBeNull();
    expect(screen.queryByText("Lịch sử nhập")).toBeNull();

    // Row links to detail page carrying returnTo
    const links = screen.getAllByRole("link", { name: /Sữa tươi Mlekovita/ });
    expect(links.length).toBeGreaterThan(0);
    expect(
      links.some((l) =>
        l.getAttribute("href")?.startsWith("/admin/inventory/items/SPM-002?returnTo=")
      )
    ).toBe(true);
  });

  it("links '+ Thêm Hàng Mua Vào' with encoded returnTo", () => {
    render(
      <ItemsClient
        categories={CATEGORIES}
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        unitLockedItemIds={[]}
        canDelete={false}
      />,
    );

    const addLink = screen.getByRole("link", { name: "+ Thêm Hàng Mua Vào" });
    expect(addLink.getAttribute("href")).toContain("/admin/inventory/items/new?returnTo=");
  });

  it("renders 'Bảng quy đổi' link in header", () => {
    render(
      <ItemsClient
        categories={CATEGORIES}
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        unitLockedItemIds={[]}
        canDelete={false}
      />,
    );

    const convLink = screen.getByRole("link", { name: "Bảng quy đổi" });
    expect(convLink).toHaveAttribute("href", "/admin/inventory/conversions");
  });

  it("canDelete=false renders no checkboxes and no removal bin", () => {
    render(
      <ItemsClient
        categories={CATEGORIES}
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        unitLockedItemIds={[]}
        canDelete={false}
      />,
    );

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Xoá\s+(?!lọc)/ })).toBeNull();
  });

  it("canDelete=true renders removal bin and checkboxes", () => {
    render(
      <ItemsClient
        categories={CATEGORIES}
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        unitLockedItemIds={[]}
        canDelete={true}
      />,
    );

    expect(screen.queryAllByRole("checkbox").length).toBeGreaterThan(0);
    const bins = screen.getAllByRole("button", { name: /^Xoá\s+(?!lọc)/ });
    expect(bins.length).toBeGreaterThan(0);
  });

  it("renders conversion summary line under secondary column", () => {
    render(
      <ItemsClient
        categories={CATEGORIES}
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        unitLockedItemIds={[]}
        canDelete={false}
      />,
    );

    expect(screen.getAllByText("1 Hộp = 1000 ml").length).toBeGreaterThan(0);
  });
});
