// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConversionDetailView } from "./ConversionDetailView";
import type { DBUOMConversion, DBPurchasedItem } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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

vi.mock("@/app/admin/inventory/conversions/actions", () => ({
  deleteConversionAction: vi.fn(),
}));

const item: DBPurchasedItem = {
  id: "SPM-002",
  name: "Sữa tươi Mlekovita",
  item_category_id: "CAT-1",
  default_unit_id: "UNT-ML",
  status: "ACTIVE",
  is_non_inventory: false,
  created_at: "2026-01-01T00:00:00Z",
};

const activeConversion: DBUOMConversion = {
  id: "QD-001",
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
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("ConversionDetailView", () => {
  it("used conversion shows button 'Ngừng dùng', unused shows 'Xoá', INACTIVE shows neither", () => {
    const returnTo = "/admin/inventory/conversions";

    // 1. Used conversion (usedCount = 5, status ACTIVE): shows "Ngừng dùng"
    const { unmount: unmount1 } = render(
      <ConversionDetailView
        conversion={activeConversion}
        item={item}
        purchaseOrderLinesCount={5}
        returnTo={returnTo}
        canDelete={true}
      />,
    );

    expect(screen.getByRole("button", { name: "Ngừng dùng" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
    expect(screen.getByText("5 dòng")).toBeInTheDocument();
    unmount1();

    // 2. Unused conversion (usedCount = 0, status ACTIVE): shows "Xoá"
    const { unmount: unmount2 } = render(
      <ConversionDetailView
        conversion={activeConversion}
        item={item}
        purchaseOrderLinesCount={0}
        returnTo={returnTo}
        canDelete={true}
      />,
    );

    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ngừng dùng" })).toBeNull();
    unmount2();

    // 3. INACTIVE conversion: shows neither
    const inactiveConversion: DBUOMConversion = {
      ...activeConversion,
      status: "INACTIVE",
    };
    const { unmount: unmount3 } = render(
      <ConversionDetailView
        conversion={inactiveConversion}
        item={item}
        purchaseOrderLinesCount={5}
        returnTo={returnTo}
        canDelete={true}
      />,
    );

    expect(screen.queryByRole("button", { name: "Ngừng dùng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
    unmount3();
  });

  it("canDelete=false shows neither delete nor deactivate button", () => {
    render(
      <ConversionDetailView
        conversion={activeConversion}
        item={item}
        purchaseOrderLinesCount={5}
        returnTo="/admin/inventory/conversions"
        canDelete={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Ngừng dùng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });

  it("renders detail fields and item link correctly", () => {
    const returnTo = "/admin/inventory/conversions?q=sữa";
    render(
      <ConversionDetailView
        conversion={activeConversion}
        item={item}
        purchaseOrderLinesCount={3}
        returnTo={returnTo}
        canDelete={false}
      />,
    );

    // Header back link
    const backLink = screen.getByRole("link", { name: /Bảng quy đổi/ });
    expect(backLink).toHaveAttribute("href", returnTo);

    // "Chỉnh sửa" link
    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink).toHaveAttribute(
      "href",
      `/admin/inventory/conversions/QD-001/edit?returnTo=${encodeURIComponent(returnTo)}`,
    );

    // Hàng hoá link to /admin/inventory/items/SPM-002
    const itemLink = screen.getByRole("link", { name: "Sữa tươi Mlekovita" });
    expect(itemLink).toHaveAttribute("href", "/admin/inventory/items/SPM-002");

    // Fields
    expect(screen.getAllByText("QD-001").length).toBeGreaterThan(0);
    expect(screen.getByText("Hộp")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(screen.getByText("ml")).toBeInTheDocument();
    expect(screen.getByText("Không")).toBeInTheDocument(); // purchase_only is false
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);
    expect(screen.getByText("3 dòng")).toBeInTheDocument();
  });
});
