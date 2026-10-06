// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import ItemsClient from "./ItemsClient";
import type { DBPurchasedItem, DBItemCategory, DBUOMConversion, DBUnit } from "@/types/db";
import type { ItemStockDisplay } from "@/lib/stock/item-stock-display";

const { replace, refresh, push, router, getSearchParams, setSearchParams } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  let currentSearchParams = new URLSearchParams("category=CAT-1");
  return {
    replace: replaceFn,
    refresh: refreshFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, push: pushFn },
    getSearchParams: () => currentSearchParams,
    setSearchParams: (params: string | URLSearchParams) => {
      currentSearchParams = typeof params === "string" ? new URLSearchParams(params) : params;
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/inventory/items",
  useSearchParams: () => getSearchParams(),
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
  setSearchParams("category=CAT-1");
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
        stockById={{}}
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
        stockById={{}}
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
        stockById={{}}
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
        stockById={{}}
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
        stockById={{}}
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
        stockById={{}}
        canDelete={false}
      />,
    );

    expect(screen.getAllByText("1 Hộp = 1000 ml").length).toBeGreaterThan(0);
  });

  it("renders stock column with figures and text kinds, and no link for 'Xem ở Tài sản'", () => {
    const items: DBPurchasedItem[] = [
      {
        id: "SPM-002",
        name: "Sữa tươi Mlekovita",
        item_category_id: "CAT-1",
        status: "ACTIVE",
        is_non_inventory: false,
        default_unit_id: "",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "SPM-005",
        name: "Đá viên",
        item_category_id: "CAT-1",
        status: "ACTIVE",
        is_non_inventory: true,
        default_unit_id: "",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "SPM-078",
        name: "Muỗng nhựa định lượng 10g",
        item_category_id: "CAT-1",
        status: "ACTIVE",
        is_non_inventory: false,
        default_unit_id: "",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const stockById: Record<string, ItemStockDisplay> = {
      "SPM-002": { kind: "figure", text: "42.000 ml", onHand: 42000 },
      "SPM-005": { kind: "untracked", text: "Không theo dõi tồn" },
      "SPM-078": { kind: "equipment", text: "Xem ở Tài sản" },
    };

    render(
      <ItemsClient
        categories={CATEGORIES}
        items={items}
        conversions={[]}
        units={UNITS}
        unitLockedItemIds={[]}
        stockById={stockById}
        canDelete={false}
      />,
    );

    expect(screen.getByText("42.000 ml")).toBeInTheDocument();
    expect(screen.getByText("Không theo dõi tồn")).toBeInTheDocument();
    expect(screen.getByText("Xem ở Tài sản")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Xem ở Tài sản" })).toBeNull();
  });

  it("sorts by stock descending: figure rows by onHand desc, then text kinds last", () => {
    setSearchParams("category=CAT-1&sort=stock&dir=desc");

    const items: DBPurchasedItem[] = [
      {
        id: "SPM-005",
        name: "Đá viên",
        item_category_id: "CAT-1",
        status: "ACTIVE",
        is_non_inventory: true,
        default_unit_id: "",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "SPM-045",
        name: "Trứng gà",
        item_category_id: "CAT-1",
        status: "ACTIVE",
        is_non_inventory: false,
        default_unit_id: "",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "SPM-002",
        name: "Sữa tươi Mlekovita",
        item_category_id: "CAT-1",
        status: "ACTIVE",
        is_non_inventory: false,
        default_unit_id: "",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "SPM-078",
        name: "Muỗng nhựa định lượng 10g",
        item_category_id: "CAT-1",
        status: "ACTIVE",
        is_non_inventory: false,
        default_unit_id: "",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const stockById: Record<string, ItemStockDisplay> = {
      "SPM-002": { kind: "figure", text: "42.000 ml", onHand: 42000 },
      "SPM-045": { kind: "figure", text: "116 trái", onHand: 116 },
      "SPM-005": { kind: "untracked", text: "Không theo dõi tồn" },
      "SPM-078": { kind: "equipment", text: "Xem ở Tài sản" },
    };

    render(
      <ItemsClient
        categories={CATEGORIES}
        items={items}
        conversions={[]}
        units={UNITS}
        unitLockedItemIds={[]}
        stockById={stockById}
        canDelete={false}
      />,
    );

    const tableRows = screen.getAllByRole("row").slice(1);
    expect(tableRows).toHaveLength(4);

    expect(tableRows[0]).toHaveTextContent("SPM-002");
    expect(tableRows[0]).toHaveTextContent("42.000 ml");

    expect(tableRows[1]).toHaveTextContent("SPM-045");
    expect(tableRows[1]).toHaveTextContent("116 trái");

    expect(tableRows[2]).toHaveTextContent("SPM-005");
    expect(tableRows[2]).toHaveTextContent("Không theo dõi tồn");

    expect(tableRows[3]).toHaveTextContent("SPM-078");
    expect(tableRows[3]).toHaveTextContent("Xem ở Tài sản");
  });
});
