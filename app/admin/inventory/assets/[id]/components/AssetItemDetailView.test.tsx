// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AssetItemDetailView } from "./AssetItemDetailView";
import type { AssetItemDetail } from "@/lib/assets/asset-items";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/assets/SPM-BINH",
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

// Real figures from the plan:
// Bình bơm (thuỷ tinh, 1300ml, 10ml/lần): 1 lot TS-004, total 411.840đ, 2 items, 24 months.
// Disposed 1 item on 2026-07-02 (TL-002, empty reason).
// Disposal charge: 171.600đ.
// Month 2026-07: charge 188.760đ, including 171.600đ disposal charge.
// Charged to date: 265.980đ, remaining value: 145.860đ.
const BINH_BOM_DETAIL: AssetItemDetail = {
  item: {
    itemId: "SPM-BINH",
    name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
    quantity: 2,
    remainingQuantity: 1,
    disposedQuantity: 1,
    remainingValue: 145860,
    latestAcquiredDate: "2026-04-04",
    fullyDisposed: false,
    totalCost: 411840,
    chargedToDate: 265980,
  },
  lots: [
    {
      id: "TS-004",
      name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
      nameSnapshot: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
      purchaseOrderId: "PO-009",
      acquiredDate: "2026-04-04",
      unitCost: 205920,
      totalCost: 411840,
      quantity: 2,
      remainingQuantity: 1,
      termMonths: 24,
      remainingValue: 145860,
      bucket: "IN_USE",
    },
  ],
  disposals: [
    {
      id: "TL-002",
      assetId: "TS-004",
      lotAcquiredDate: "2026-04-04",
      quantity: 1,
      disposedDate: "2026-07-02",
      reason: "", // empty reason
      charge: 171600,
    },
  ],
  months: [
    { month: "2026-04", unitsHeld: 2, charge: 17160, disposalCharge: 0 },
    { month: "2026-05", unitsHeld: 2, charge: 17160, disposalCharge: 0 },
    { month: "2026-06", unitsHeld: 2, charge: 17160, disposalCharge: 0 },
    { month: "2026-07", unitsHeld: 1, charge: 188760, disposalCharge: 171600 },
    { month: "2026-08", unitsHeld: 1, charge: 8580, disposalCharge: 0 },
  ],
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("AssetItemDetailView", () => {
  const returnTo = "/admin/inventory/assets";

  it("renders header with item name, code, back link to returnTo, and 'Xem hàng hoá' link", () => {
    render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);

    // Header back link
    const backLink = screen.getByRole("link", { name: /Tài sản/ });
    expect(backLink).toHaveAttribute("href", returnTo);

    // Title and code
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("SPM-BINH").length).toBeGreaterThan(0);

    // "Xem hàng hoá" link
    const itemLink = screen.getByRole("link", { name: "Xem hàng hoá" });
    expect(itemLink).toHaveAttribute("href", "/admin/inventory/items/SPM-BINH");
  });

  it("renders summary field list with real figures (total cost, charged to date, remaining value, quantities)", () => {
    render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);

    expect(screen.getAllByText("SPM-BINH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 / 2 cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("411,840đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("265,980đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("145,860đ").length).toBeGreaterThan(0);
  });

  it("renders three section tables: 'Các lần mua', 'Thanh lý', and 'Khấu hao theo tháng'", () => {
    render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);

    expect(screen.getAllByText(/Các lần mua/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Thanh lý/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Khấu hao theo tháng/).length).toBeGreaterThan(0);
  });

  it("renders 'Các lần mua' table with lot details and link to purchase order", () => {
    render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);

    expect(screen.getAllByText("TS-004").length).toBeGreaterThan(0);
    expect(screen.getAllByText("04/04/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("205,920đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("24 tháng").length).toBeGreaterThan(0);

    const poLinks = screen.getAllByRole("link", { name: "PO-009" });
    expect(poLinks.length).toBeGreaterThan(0);
    for (const l of poLinks) expect(l).toHaveAttribute("href", "/admin/inventory/purchase-orders/PO-009");
  });

  it("renders 'Thanh lý' table showing 171,600đ disposal charge and dash '—' for empty reason", () => {
    render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);

    expect(screen.getAllByText("02/07/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("171,600đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders 'Khấu hao theo tháng' table with 'gồm 171,600đ thanh lý' for 07/2026", () => {
    render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);

    expect(screen.getAllByText("07/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("188,760đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("gồm 171,600đ thanh lý").length).toBeGreaterThan(0);
  });

  it("renders 'Thanh lý' action button linking to dispose page when remainingQuantity > 0", () => {
    render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);

    const disposeLink = screen.getByRole("link", { name: "Thanh lý" });
    expect(disposeLink).toHaveAttribute(
      "href",
      `/admin/inventory/assets/SPM-BINH/dispose?returnTo=${encodeURIComponent("/admin/inventory/assets/SPM-BINH?returnTo=" + encodeURIComponent(returnTo))}`,
    );
  });

  it("hides 'Thanh lý' action button and displays 'Đã thanh lý hết' when remainingQuantity is 0", () => {
    const fullyDisposedDetail: AssetItemDetail = {
      ...BINH_BOM_DETAIL,
      item: {
        ...BINH_BOM_DETAIL.item,
        remainingQuantity: 0,
        disposedQuantity: 2,
        remainingValue: 0,
        fullyDisposed: true,
      },
    };

    render(<AssetItemDetailView detail={fullyDisposedDetail} returnTo={returnTo} />);

    expect(screen.queryByRole("link", { name: "Thanh lý" })).toBeNull();
    expect(screen.getAllByText("Đã thanh lý hết").length).toBeGreaterThan(0);
  });
});
