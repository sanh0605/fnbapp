// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ItemDetailView } from "./ItemDetailView";
import type { DBPurchasedItem, DBItemCategory, DBUOMConversion, DBUnit } from "@/types/db";
import type { ItemPurchaseHistoryRow } from "@/lib/purchasing/item-purchase-history";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/items",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../actions", () => ({
  deletePurchasedItemAction: vi.fn(),
}));

const mlekovitaItem: DBPurchasedItem = {
  id: "SPM-002",
  name: "Sữa tươi Mlekovita",
  item_category_id: "CAT-1",
  default_unit_id: "UNT-ML",
  status: "ACTIVE",
  is_non_inventory: false,
  created_at: "2026-01-01T00:00:00Z",
};

const category: DBItemCategory = {
  id: "CAT-1",
  name: "Nguyên liệu",
  system_type: "RAW",
  status: "ACTIVE",
  created_at: "2026-01-01T00:00:00Z",
};

const mlekovitaConversions: DBUOMConversion[] = [
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

const units: DBUnit[] = [
  { id: "UNT-ML", name: "ml", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "UNT-HOP", name: "Hộp", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
];

const purchaseHistory: ItemPurchaseHistoryRow[] = [];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("ItemDetailView", () => {
  it("renders Sữa tươi Mlekovita with one conversion and checks detail view elements", () => {
    const returnTo = "/admin/inventory/items?q=sữa";
    render(
      <ItemDetailView
        item={mlekovitaItem}
        category={category}
        conversions={mlekovitaConversions}
        units={units}
        purchaseHistory={purchaseHistory}
        returnTo={returnTo}
        canDelete={false}
      />,
    );

    // Shows "Quy đổi (1)"
    expect(screen.getByText("Quy đổi (1)")).toBeInTheDocument();

    // "Chỉnh sửa" trỏ /admin/inventory/items/SPM-002/edit?returnTo=%2Fadmin%2Finventory%2Fitems%3Fq%3Ds%E1%BB%AFa
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink).toHaveAttribute(
      "href",
      `/admin/inventory/items/SPM-002/edit?returnTo=${encodeURIComponent(returnTo)}`,
    );

    // canDelete=false thì không có nút "Xoá"
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();

    // Fields: Mã, Tên, Phân loại, Tính tồn kho, Trạng thái
    expect(screen.getAllByText("SPM-002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sữa tươi Mlekovita").length).toBeGreaterThan(0);
    expect(screen.getByText("Nguyên liệu")).toBeInTheDocument();
    expect(screen.getByText("Có")).toBeInTheDocument(); // is_non_inventory: false -> "Có"
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);

    // Link "Xem trong Bảng quy đổi →" to /admin/inventory/conversions?q=Sữa tươi Mlekovita
    const convLink = screen.getByRole("link", { name: /Xem trong Bảng quy đổi/ });
    expect(convLink).toHaveAttribute(
      "href",
      `/admin/inventory/conversions?q=${encodeURIComponent("Sữa tươi Mlekovita")}`,
    );

    // Section "Lịch sử nhập"
    expect(screen.getByText("Lịch sử nhập")).toBeInTheDocument();

    // Back link "Hàng hoá" to returnTo
    const backLink = screen.getByRole("link", { name: /Hàng hoá/ });
    expect(backLink).toHaveAttribute("href", returnTo);
  });

  it("renders delete button when canDelete is true", () => {
    render(
      <ItemDetailView
        item={mlekovitaItem}
        category={category}
        conversions={mlekovitaConversions}
        units={units}
        purchaseHistory={purchaseHistory}
        returnTo="/admin/inventory/items"
        canDelete={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Xoá/ })).toBeInTheDocument();
  });

  it("displays 'Không' for non-inventory item and 'Ngừng dùng' for INACTIVE status", () => {
    const nonInvItem: DBPurchasedItem = {
      ...mlekovitaItem,
      id: "SPM-003",
      is_non_inventory: true,
      status: "INACTIVE",
    };

    render(
      <ItemDetailView
        item={nonInvItem}
        category={category}
        conversions={[]}
        units={units}
        purchaseHistory={[]}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />,
    );

    expect(screen.getByText("Không")).toBeInTheDocument();
    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);
    expect(screen.getByText("Quy đổi (0)")).toBeInTheDocument();
  });

  it("shows 'Tồn kho hiện tại' and '42.000 ml' for a tracked item with stock", () => {
    render(
      <ItemDetailView
        item={mlekovitaItem}
        category={category}
        conversions={mlekovitaConversions}
        units={units}
        purchaseHistory={purchaseHistory}
        stock={{ kind: "figure", text: "42.000 ml", onHand: 42000 }}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />,
    );

    expect(screen.getByText("Tồn kho hiện tại")).toBeInTheDocument();
    expect(screen.getByText("42.000 ml")).toBeInTheDocument();
  });

  it("shows link 'Xem ở Tài sản' with href '/admin/inventory/assets?q=SPM-078' for equipment stock", () => {
    const equipmentItem: DBPurchasedItem = {
      id: "SPM-078",
      name: "Muỗng nhựa định lượng 10g",
      item_category_id: "CAT-1",
      status: "ACTIVE",
      is_non_inventory: false,
      default_unit_id: "",
      created_at: "2026-01-01T00:00:00Z",
    };

    render(
      <ItemDetailView
        item={equipmentItem}
        category={category}
        conversions={[]}
        units={units}
        purchaseHistory={[]}
        stock={{ kind: "equipment", text: "Xem ở Tài sản" }}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />,
    );

    expect(screen.getByText("Tồn kho hiện tại")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Xem ở Tài sản" });
    expect(link).toHaveAttribute("href", "/admin/inventory/assets?q=SPM-078");
  });

  it("shows '—' for missing stock", () => {
    render(
      <ItemDetailView
        item={mlekovitaItem}
        category={category}
        conversions={mlekovitaConversions}
        units={units}
        purchaseHistory={purchaseHistory}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />,
    );

    expect(screen.getByText("Tồn kho hiện tại")).toBeInTheDocument();
  });
});
