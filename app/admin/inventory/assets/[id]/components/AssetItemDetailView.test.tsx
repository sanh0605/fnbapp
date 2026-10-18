// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
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
      proceeds: null,
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
    expect(screen.getAllByText("04/04/2026 00:00:00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("205,920đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("24 tháng").length).toBeGreaterThan(0);

    const poLinks = screen.getAllByRole("link", { name: "PO-009" });
    expect(poLinks.length).toBeGreaterThan(0);
    for (const l of poLinks) expect(l).toHaveAttribute("href", "/admin/inventory/purchase-orders/PO-009");
  });

  it("renders 'Thanh lý' table showing 171,600đ disposal charge and dash '—' for empty reason", () => {
    render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);

    expect(screen.getAllByText("02/07/2026 00:00:00").length).toBeGreaterThan(0);
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

  it("renders 'Thu được' in Thanh lý table and phone cards for cash, transfer, null, and cancelled cases", () => {
    const detailWithDisposals: AssetItemDetail = {
      ...BINH_BOM_DETAIL,
      disposals: [
        {
          id: "TL-001",
          assetId: "TS-004",
          lotAcquiredDate: "2026-04-04",
          quantity: 1,
          disposedDate: "2026-07-02",
          reason: "Bỏ đi",
          charge: 0,
          proceeds: null,
        },
        {
          id: "TL-002",
          assetId: "TS-004",
          lotAcquiredDate: "2026-04-04",
          quantity: 1,
          disposedDate: "2026-07-03",
          reason: "Bán lại tiền mặt",
          charge: 0,
          proceeds: {
            amount: 1200000,
            paymentMethod: "CASH",
            bankAccountName: null,
            status: "ACTIVE",
          },
        },
        {
          id: "TL-003",
          assetId: "TS-004",
          lotAcquiredDate: "2026-04-04",
          quantity: 1,
          disposedDate: "2026-07-04",
          reason: "Bán lại chuyển khoản",
          charge: 0,
          proceeds: {
            amount: 1200000,
            paymentMethod: "BANK_TRANSFER",
            bankAccountName: "Vietcombank",
            status: "ACTIVE",
          },
        },
        {
          id: "TL-004",
          assetId: "TS-004",
          lotAcquiredDate: "2026-04-04",
          quantity: 1,
          disposedDate: "2026-07-05",
          reason: "Bán lại đã huỷ",
          charge: 0,
          proceeds: {
            amount: 1200000,
            paymentMethod: "CASH",
            bankAccountName: null,
            status: "CANCELLED",
          },
        },
      ],
    };

    const { container } = render(<AssetItemDetailView detail={detailWithDisposals} returnTo={returnTo} />);

    // Desktop table header
    expect(screen.getByRole("columnheader", { name: "Thu được" })).toBeInTheDocument();

    // Desktop table rows render proceeds
    // Case 1: null -> 0đ
    expect(screen.getAllByText("0đ").length).toBeGreaterThan(0);

    // Case 2: CASH -> 1,200,000đ · Tiền mặt
    expect(screen.getAllByText("1,200,000đ · Tiền mặt").length).toBeGreaterThan(0);

    // Case 3: BANK_TRANSFER -> 1,200,000đ · Vietcombank
    expect(screen.getAllByText("1,200,000đ · Vietcombank").length).toBeGreaterThan(0);

    // Case 4: CANCELLED -> amount struck through plus " (đã huỷ)"
    const cancelledTexts = screen.getAllByText((_content, element) => {
      return element?.textContent === "1,200,000đ · Tiền mặt (đã huỷ)";
    });
    expect(cancelledTexts.length).toBeGreaterThan(0);

    // On phone, keep "Thu được:" label next to proceeds inside the .md:hidden container
    const phoneDisposals = container.querySelectorAll(".md\\:hidden")[1];
    expect(phoneDisposals).not.toBeNull();
    expect(phoneDisposals.textContent).toContain("Thu được: 0đ");
    expect(phoneDisposals.textContent).toContain("Thu được: 1,200,000đ · Tiền mặt");
    expect(phoneDisposals.textContent).toContain("Thu được: 1,200,000đ · Vietcombank");
    expect(phoneDisposals.textContent).toContain("Thu được: 1,200,000đ · Tiền mặt (đã huỷ)");

    // Verify struck-through amount
    const struckAmounts = screen
      .getAllByText("1,200,000đ")
      .filter((el) => el.classList.contains("line-through"));
    expect(struckAmounts.length).toBeGreaterThan(0);
  });

  it("renders 'Các lần mua' child rows on phone as a divide-y list of PhoneRow", () => {
    const { container } = render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);
    const phoneSection = container.querySelector(".md\\:hidden");
    expect(phoneSection).not.toBeNull();
    expect(phoneSection?.className).toContain("divide-y");

    const rows = phoneSection?.querySelectorAll(":scope > *");
    expect(rows?.length).toBe(1);
    const firstRow = rows?.[0] as HTMLElement;
    expect(firstRow?.tagName).toBe("A");
    expect(firstRow?.getAttribute("href")).toBe("/admin/inventory/purchase-orders/PO-009");
    expect(firstRow?.className).toContain("block");
    expect(firstRow?.className).toContain("min-h-[48px]");
    expect(firstRow?.className).toContain("px-4");
    expect(firstRow?.className).toContain("py-2.5");
    expect(firstRow?.className).not.toContain("p-4");

    // PhoneRow: line 1 has date 04/04/2026 00:00:00 and remaining value 145,860đ
    expect(within(firstRow).getByText("04/04/2026 00:00:00").className).toContain("text-base");
    expect(firstRow?.textContent).toContain("145,860đ");
    // Line 2 has meta: TS-004, remaining/quantity, unit cost ("Giá một cái" value), term, PO
    expect(
      within(firstRow).getAllByText("TS-004").some((el) => /^TS-004 · Còn 1\/2 cái/.test(el.parentElement?.textContent ?? "")),
    ).toBe(true);
    expect(firstRow?.textContent).toContain("205,920đ");
    expect(firstRow?.textContent).toContain("24 tháng");
    expect(firstRow?.textContent).toContain("PO-009");
  });

  it("renders 'Thanh lý' child rows on phone as a divide-y list of PhoneRow", () => {
    const { container } = render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);
    const phoneSections = container.querySelectorAll(".md\\:hidden");
    const disposalSection = phoneSections[1];
    expect(disposalSection).not.toBeNull();
    expect(disposalSection?.className).toContain("divide-y");

    const rows = disposalSection?.querySelectorAll(":scope > div");
    expect(rows?.length).toBe(1);
    const firstRow = rows?.[0];
    expect(firstRow?.className).toContain("px-4");
    expect(firstRow?.className).toContain("py-2.5");
    expect(firstRow?.className).not.toContain("p-4");

    // Line 1: disposed date and charge
    expect(firstRow?.textContent).toContain("02/07/2026 00:00:00");
    expect(firstRow?.textContent).toContain("171,600đ");
    // Old card labels should not exist
    expect(firstRow?.textContent).not.toContain("Lần mua:");
    expect(firstRow?.textContent).not.toContain("Lý do:");

    const lotCode = within(firstRow as HTMLElement).getByText("(TS-004)");
    expect(lotCode.className).toContain("whitespace-nowrap");
    expect(lotCode.parentElement?.textContent).toBe("04/04/2026 00:00:00 (TS-004)");
  });

  it("renders 'Khấu hao theo tháng' child rows on phone as a divide-y list of PhoneRow", () => {
    const { container } = render(<AssetItemDetailView detail={BINH_BOM_DETAIL} returnTo={returnTo} />);
    const phoneSections = container.querySelectorAll(".md\\:hidden");
    const monthSection = phoneSections[2];
    expect(monthSection).not.toBeNull();
    expect(monthSection?.className).toContain("divide-y");

    const rows = monthSection?.querySelectorAll(":scope > div");
    expect(rows?.length).toBe(5);
    const julyRow = rows?.[3]; // 2026-07
    expect(julyRow?.className).toContain("px-4");
    expect(julyRow?.className).toContain("py-2.5");
    expect(julyRow?.className).not.toContain("p-4");

    // Line 1: month and charge
    expect(julyRow?.textContent).toContain("07/2026");
    expect(julyRow?.textContent).toContain("188,760đ");
    // Line 2: disposal charge
    expect(julyRow?.textContent).toContain("gồm 171,600đ thanh lý");
    // Old label "Số cái giữ:" replaced by clean meta
    expect(julyRow?.textContent).not.toContain("Số cái giữ:");
  });
});
