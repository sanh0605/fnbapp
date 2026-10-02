// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AssetDetailView } from "./AssetDetailView";
import type { AssetView, AssetDisposalView } from "../../actions";
import type { MonthlyCharge } from "@/lib/assets/asset-depreciation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/assets/TS-004",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const TS004_ASSET: AssetView = {
  id: "TS-004",
  name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
  quantity: 2,
  remainingQuantity: 1,
  acquiredDate: "2026-04-04",
  unitCost: 205920,
  totalCost: 411840,
  termMonths: 24,
  remainingValue: 145860,
  bucket: "IN_USE",
};

const TS004_DISPOSALS: AssetDisposalView[] = [
  {
    id: "TL-002",
    quantity: 1,
    disposedDate: "2026-07-02",
    reason: "",
  },
];

const CHARGED_TO_DATE = 265980;

// 24-row schedule for TS-004:
// 04, 05, 06/2026: 17.160đ
// 07/2026: 188.760đ
// 08/2026 to 03/2028: 8.580đ
const TS004_SCHEDULE: MonthlyCharge[] = [
  { month: "2026-04", unitsHeld: 2, charge: 17160 },
  { month: "2026-05", unitsHeld: 2, charge: 17160 },
  { month: "2026-06", unitsHeld: 2, charge: 17160 },
  { month: "2026-07", unitsHeld: 1, charge: 188760 },
  ...Array.from({ length: 20 }, (_, i) => {
    const totalMonth = 2026 * 12 + 7 + i; // 2026-08 onwards
    const y = Math.floor(totalMonth / 12);
    const m = (totalMonth % 12) + 1;
    return {
      month: `${y}-${String(m).padStart(2, "0")}`,
      unitsHeld: 1,
      charge: 8580,
    };
  }),
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("AssetDetailView", () => {
  it("renders TS-004 details, fields, schedule table, and disposals table", () => {
    const returnTo = "/admin/inventory/assets";
    render(
      <AssetDetailView
        asset={TS004_ASSET}
        schedule={TS004_SCHEDULE}
        disposals={TS004_DISPOSALS}
        chargedToDate={CHARGED_TO_DATE}
        returnTo={returnTo}
      />,
    );

    // Header back link
    const backLink = screen.getByRole("link", { name: /Tài sản/ });
    expect(backLink).toHaveAttribute("href", returnTo);

    // Header title, subtitle, and badge
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("TS-004").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Còn dùng").length).toBeGreaterThan(0);

    // "Thanh lý" action link
    const disposeLink = screen.getByRole("link", { name: "Thanh lý" });
    expect(disposeLink).toHaveAttribute(
      "href",
      "/admin/inventory/assets/TS-004/dispose?returnTo=%2Fadmin%2Finventory%2Fassets%2FTS-004%3FreturnTo%3D%252Fadmin%252Finventory%252Fassets",
    );

    // No "Chỉnh sửa", no "Xoá"
    expect(screen.queryByRole("link", { name: "Chỉnh sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull();
    expect(screen.queryByText("Chỉnh sửa")).toBeNull();
    expect(screen.queryByRole("link", { name: /Xoá/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
    expect(screen.queryByText(/Xoá/)).toBeNull();

    // Field list values
    expect(screen.getByText("còn 1 / mua 2 cái")).toBeInTheDocument();
    expect(screen.getAllByText("145.860đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("265.980đ").length).toBeGreaterThan(0);

    // Related sections: "Khấu hao theo tháng" and "Thanh lý (1)"
    expect(screen.getByText("Thanh lý (1)")).toBeInTheDocument();
    expect(screen.getByText(/Khấu hao theo tháng/)).toBeInTheDocument();
  });

  it("does not render 'Thanh lý' action link when bucket is DISPOSED", () => {
    const disposedAsset: AssetView = {
      ...TS004_ASSET,
      remainingQuantity: 0,
      remainingValue: 0,
      bucket: "DISPOSED",
    };

    render(
      <AssetDetailView
        asset={disposedAsset}
        schedule={TS004_SCHEDULE}
        disposals={TS004_DISPOSALS}
        chargedToDate={CHARGED_TO_DATE}
        returnTo="/admin/inventory/assets"
      />,
    );

    const disposeActionLink = screen.queryByRole("link", { name: "Thanh lý" });
    expect(disposeActionLink).toBeNull();
  });

  it("shows 'Chưa thanh lý lần nào.' when there are no disposals", () => {
    render(
      <AssetDetailView
        asset={TS004_ASSET}
        schedule={TS004_SCHEDULE}
        disposals={[]}
        chargedToDate={CHARGED_TO_DATE}
        returnTo="/admin/inventory/assets"
      />,
    );

    expect(screen.getByText("Thanh lý (0)")).toBeInTheDocument();
    expect(screen.getByText("Chưa thanh lý lần nào.")).toBeInTheDocument();
  });
});
