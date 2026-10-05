// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import ConversionsClient from "./ConversionsClient";
import type { DBPurchasedItem, DBUOMConversion, DBUnit } from "@/types/db";

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
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/conversions",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../actions", () => ({
  deleteConversionAction: vi.fn(),
}));

const ITEMS: DBPurchasedItem[] = [
  { id: "ITEM-1", name: "Sữa đặc", item_category_id: "CAT-1", default_unit_id: "UNT-LON", status: "ACTIVE", is_non_inventory: false, created_at: "2026-01-01T00:00:00Z" },
  { id: "ITEM-2", name: "Trà đen", item_category_id: "CAT-1", default_unit_id: "UNT-G", status: "ACTIVE", is_non_inventory: false, created_at: "2026-01-01T00:00:00Z" },
];

const CONVERSIONS: DBUOMConversion[] = [
  {
    id: "CONV-1",
    purchased_item_id: "ITEM-1",
    from_unit_id: "UNT-THUNG",
    to_unit_id: "UNT-LON",
    factor: "24",
    purchased_unit: "UNT-THUNG",
    conversion_rate: "24",
    base_unit: "UNT-LON",
    status: "ACTIVE",
    purchase_only: false,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "CONV-2",
    purchased_item_id: "ITEM-2",
    from_unit_id: "UNT-GOI",
    to_unit_id: "UNT-G",
    factor: "500",
    purchased_unit: "UNT-GOI",
    conversion_rate: "500",
    base_unit: "UNT-G",
    status: "ACTIVE",
    purchase_only: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const UNITS: DBUnit[] = [
  { id: "UNT-THUNG", name: "Thùng", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "UNT-LON", name: "Lon", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "UNT-GOI", name: "Gói", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "UNT-G", name: "g", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
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

describe("ConversionsClient", () => {
  it("renders row linking to detail page instead of removed Sửa button", () => {
    render(
      <ConversionsClient
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        usedConversionIds={["CONV-1"]}
        canDelete={false}
        initialSearch="sữa"
      />,
    );

    // No "Sửa" link
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    expect(screen.queryByText("Sửa")).toBeNull();

    // Row links to detail page carrying returnTo
    const links = screen.getAllByRole("link", { name: /Sữa đặc/ });
    expect(links.length).toBeGreaterThan(0);
    expect(
      links.some((l) =>
        l.getAttribute("href")?.startsWith("/admin/inventory/conversions/CONV-1?returnTo=")
      )
    ).toBe(true);

    // Add button links to new page
    const addLink = screen.getByRole("link", { name: "+ Thêm Quy Đổi" });
    expect(addLink.getAttribute("href")).toContain("/admin/inventory/conversions/new?returnTo=");
  });

  it("updates URL with router.replace when typing in search input", () => {
    render(
      <ConversionsClient
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        usedConversionIds={[]}
        canDelete={false}
        initialSearch=""
      />,
    );

    const input = screen.getByPlaceholderText("Tên hàng hóa...");
    fireEvent.change(input, { target: { value: "sữa" } });
    expect(replace).toHaveBeenCalledWith("/admin/inventory/conversions?q=s%E1%BB%AFa", { scroll: false });
  });

  it("sets bin aria-label to 'Ngừng dùng <item name>' for a used conversion and 'Xoá <item name>' for an unused one", () => {
    // CONV-1 is used, CONV-2 is unused
    render(
      <ConversionsClient
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        usedConversionIds={["CONV-1"]}
        canDelete={true}
        initialSearch=""
      />,
    );

    // Used conversion: bin aria-label is "Ngừng dùng Sữa đặc"
    expect(screen.getAllByRole("button", { name: "Ngừng dùng Sữa đặc" }).length).toBeGreaterThan(0);

    // Unused conversion: bin aria-label is "Xoá Trà đen"
    expect(screen.getAllByRole("button", { name: "Xoá Trà đen" }).length).toBeGreaterThan(0);
  });

  it("canDelete=false renders no checkboxes and no bin buttons", () => {
    render(
      <ConversionsClient
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        usedConversionIds={["CONV-1"]}
        canDelete={false}
        initialSearch=""
      />,
    );

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Xoá|Ngừng dùng/ })).toBeNull();
  });

  it("renders 'Chỉ cách mua' badge for purchase_only conversions", () => {
    render(
      <ConversionsClient
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        usedConversionIds={[]}
        canDelete={false}
        initialSearch=""
      />,
    );

    expect(screen.getAllByText("Chỉ cách mua").length).toBeGreaterThan(0);
  });
});
