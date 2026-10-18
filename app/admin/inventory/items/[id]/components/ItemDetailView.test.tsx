// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ItemDetailView } from "./ItemDetailView";
import type { DBPurchasedItem, DBItemCategory, DBUOMConversion, DBUnit } from "@/types/db";
import type { ItemPurchaseHistoryRow } from "@/lib/purchasing/item-purchase-history";

const { refreshMock, pushMock } = vi.hoisted(() => {
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  return { refreshMock: refreshFn, pushMock: pushFn };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
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

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: (...args: any[]) => confirmMock(...args),
}));

const { setPurchasedItemStatusMock, deletePurchasedItemActionMock } = vi.hoisted(() => ({
  setPurchasedItemStatusMock: vi.fn(),
  deletePurchasedItemActionMock: vi.fn(),
}));


vi.mock("../../actions", () => ({
  setPurchasedItemStatus: (...args: any[]) => setPurchasedItemStatusMock(...args),
  deletePurchasedItemAction: (...args: any[]) => deletePurchasedItemActionMock(...args),
}));

const mlekovitaItem: DBPurchasedItem = {
  id: "SPM-002",
  name: "Sữa tươi Mlekovita",
  item_category_id: "CAT-1",
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
  { id: "UNT-ML", name: "ml", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  { id: "UNT-HOP", name: "Hộp", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
];

const purchaseHistory: ItemPurchaseHistoryRow[] = [];

beforeEach(() => {
  refreshMock.mockReset();
  pushMock.mockReset();
  confirmMock.mockReset();
  setPurchasedItemStatusMock.mockReset();
  deletePurchasedItemActionMock.mockReset();
});

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

  it("ACTIVE item shows 'Ngừng dùng', INACTIVE shows 'Dùng lại'", () => {
    const { unmount } = render(
      <ItemDetailView
        item={mlekovitaItem}
        category={category}
        conversions={mlekovitaConversions}
        units={units}
        purchaseHistory={purchaseHistory}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />
    );
    expect(screen.getByRole("button", { name: "Ngừng dùng" })).toBeInTheDocument();

    unmount();

    const inactiveItem: DBPurchasedItem = {
      ...mlekovitaItem,
      status: "INACTIVE",
    };
    render(
      <ItemDetailView
        item={inactiveItem}
        category={category}
        conversions={mlekovitaConversions}
        units={units}
        purchaseHistory={purchaseHistory}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />
    );
    expect(screen.getByRole("button", { name: "Dùng lại" })).toBeInTheDocument();
  });

  it("clicking 'Dùng lại' calls setPurchasedItemStatus with id and status ACTIVE", async () => {
    setPurchasedItemStatusMock.mockResolvedValue({});
    const inactiveItem: DBPurchasedItem = {
      ...mlekovitaItem,
      status: "INACTIVE",
    };

    render(
      <ItemDetailView
        item={inactiveItem}
        category={category}
        conversions={[]}
        units={units}
        purchaseHistory={[]}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />
    );

    const reactivateBtn = screen.getByRole("button", { name: "Dùng lại" });
    fireEvent.click(reactivateBtn);

    await waitFor(() => {
      expect(setPurchasedItemStatusMock).toHaveBeenCalledTimes(1);
    });

    const fd: FormData = setPurchasedItemStatusMock.mock.calls[0][0];
    expect(fd.get("id")).toBe("SPM-002");
    expect(fd.get("status")).toBe("ACTIVE");
    expect(confirmMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("clicking 'Ngừng dùng' asks confirmation and calls setPurchasedItemStatus with INACTIVE on confirm", async () => {
    confirmMock.mockResolvedValue(true);
    setPurchasedItemStatusMock.mockResolvedValue({});

    render(
      <ItemDetailView
        item={mlekovitaItem}
        category={category}
        conversions={[]}
        units={units}
        purchaseHistory={[]}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />
    );

    const stopBtn = screen.getByRole("button", { name: "Ngừng dùng" });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith({
        title: "Ngừng dùng",
        message: "Ngừng dùng Sữa tươi Mlekovita? Phiếu nhập mới sẽ không chọn được hàng này; phiếu xuất và kiểm kê vẫn dùng được.",
        variant: "danger",
      });
      expect(setPurchasedItemStatusMock).toHaveBeenCalledTimes(1);
    });

    const fd: FormData = setPurchasedItemStatusMock.mock.calls[0][0];
    expect(fd.get("id")).toBe("SPM-002");
    expect(fd.get("status")).toBe("INACTIVE");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("cancelling 'Ngừng dùng' does not call setPurchasedItemStatus", async () => {
    confirmMock.mockResolvedValue(false);

    render(
      <ItemDetailView
        item={mlekovitaItem}
        category={category}
        conversions={[]}
        units={units}
        purchaseHistory={[]}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />
    );

    const stopBtn = screen.getByRole("button", { name: "Ngừng dùng" });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
    });

    expect(setPurchasedItemStatusMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows error alert near header when setPurchasedItemStatus fails", async () => {
    setPurchasedItemStatusMock.mockResolvedValue({ error: "Lỗi lưu trạng thái hàng hoá" });
    const inactiveItem: DBPurchasedItem = {
      ...mlekovitaItem,
      status: "INACTIVE",
    };

    render(
      <ItemDetailView
        item={inactiveItem}
        category={category}
        conversions={[]}
        units={units}
        purchaseHistory={[]}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Dùng lại" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Lỗi lưu trạng thái hàng hoá");
    expect(refreshMock).not.toHaveBeenCalled();
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
        stock={{ kind: "untracked", text: "Không theo dõi tồn" }}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />,
    );

    expect(screen.getByText("Không")).toBeInTheDocument();
    expect(screen.queryByText("Tồn kho hiện tại")).toBeNull();
    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);
    expect(screen.getByText("Quy đổi (0)")).toBeInTheDocument();
  });

  it("an item whose stock is untracked shows no 'Tồn kho hiện tại'", () => {
    render(
      <ItemDetailView
        item={mlekovitaItem}
        category={category}
        conversions={[]}
        units={units}
        purchaseHistory={[]}
        stock={{ kind: "untracked", text: "Không theo dõi tồn" }}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />,
    );

    expect(screen.queryByText("Tồn kho hiện tại")).toBeNull();
  });

  it("an equipment item whose is_non_inventory is true still shows 'Tồn kho hiện tại' with its link", () => {
    const equipmentItem: DBPurchasedItem = {
      id: "SPM-078",
      name: "Muỗng nhựa định lượng 10g",
      item_category_id: "CAT-1",
      status: "ACTIVE",
      is_non_inventory: true,
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

  it("accepts string 'TRUE' for is_non_inventory", () => {
    const itemWithTextFlag: DBPurchasedItem = {
      ...mlekovitaItem,
      id: "SPM-004",
      is_non_inventory: "TRUE" as any,
    };

    render(
      <ItemDetailView
        item={itemWithTextFlag}
        category={category}
        conversions={[]}
        units={units}
        purchaseHistory={[]}
        returnTo="/admin/inventory/items"
        canDelete={false}
      />,
    );

    expect(screen.getByText("Không")).toBeInTheDocument();
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

  it("renders conversions child rows on phone as a divide-y list of PhoneRow", () => {
    const { container } = render(
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

    const phoneSection = container.querySelector(".md\\:hidden");
    expect(phoneSection).not.toBeNull();
    expect(phoneSection?.className).toContain("divide-y");

    const rows = phoneSection?.querySelectorAll(":scope > div");
    expect(rows?.length).toBe(1);
    const firstRow = rows?.[0];
    expect(firstRow?.className).toContain("px-4");
    expect(firstRow?.className).toContain("py-2.5");
    expect(firstRow?.className).not.toContain("p-4");

    // PhoneRow: line 1 has conversion formula, line 2 has badge
    expect(firstRow?.textContent).toContain("1 Hộp = 1,000 ml");
    expect(firstRow?.textContent).toContain("Đang dùng");
  });
});
