// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AssetsClient from "./AssetsClient";
import type { AssetView } from "../actions";

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

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/admin/inventory/assets",
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

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

describe("AssetsClient", () => {
  it("renders rows linking to /admin/inventory/assets/TS-004?returnTo=...", () => {
    render(<AssetsClient assets={[TS004_ASSET]} />);

    const links = screen.getAllByRole("link").filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/inventory/assets/TS-004?returnTo="),
    );
    expect(links.length).toBeGreaterThan(0);
  });

  it("does not render 'Đánh dấu hỏng / thanh lý'", () => {
    render(<AssetsClient assets={[TS004_ASSET]} />);

    expect(screen.queryByText("Đánh dấu hỏng / thanh lý")).toBeNull();
    expect(screen.queryByRole("link", { name: "Đánh dấu hỏng / thanh lý" })).toBeNull();
  });

  it("does not render 'Sửa'", () => {
    render(<AssetsClient assets={[TS004_ASSET]} />);

    expect(screen.queryByText("Sửa")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
  });

  it("does not render any checkbox", () => {
    render(<AssetsClient assets={[TS004_ASSET]} />);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("does not render delete button", () => {
    render(<AssetsClient assets={[TS004_ASSET]} />);

    expect(screen.queryByRole("button", { name: /Xoá/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Trash/i })).toBeNull();
  });

  it("renders desktop columns with formatted asset details", () => {
    render(<AssetsClient assets={[TS004_ASSET]} />);

    expect(screen.getByText("TS-004")).toBeInTheDocument();
    expect(
      screen.getAllByText("Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("1 / 2 cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("145.860đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Còn dùng").length).toBeGreaterThan(0);
  });

  it("renders empty state when there are no assets", () => {
    render(<AssetsClient assets={[]} />);

    expect(screen.getByText("Không có tài sản nào ở mục này.")).toBeInTheDocument();
  });

  describe("sorting (BR-DATA-008)", () => {
    const ASSET_A: AssetView = {
      id: "TS-010",
      name: "Bình giữ nhiệt 1L",
      quantity: 5,
      remainingQuantity: 5,
      acquiredDate: "2026-03-01",
      unitCost: 200000,
      totalCost: 1000000,
      termMonths: 12,
      remainingValue: 50000,
      bucket: "IN_USE",
    };

    const ASSET_B: AssetView = {
      id: "TS-002",
      name: "Máy pha cà phê Expobar",
      quantity: 1,
      remainingQuantity: 1,
      acquiredDate: "2026-01-01",
      unitCost: 35000000,
      totalCost: 35000000,
      termMonths: 36,
      remainingValue: 25000000,
      bucket: "IN_USE",
    };

    const ASSET_C: AssetView = {
      id: "TS-001",
      name: "Máy xay sinh tố Omniblend",
      quantity: 2,
      remainingQuantity: 2,
      acquiredDate: "2026-02-01",
      unitCost: 3500000,
      totalCost: 7000000,
      termMonths: 24,
      remainingValue: 4000000,
      bucket: "IN_USE",
    };

    it("sorts assets by code ascending by default", () => {
      // Pass unsorted assets: TS-010, TS-002, TS-001
      render(<AssetsClient assets={[ASSET_A, ASSET_B, ASSET_C]} />);

      const rows = screen.getAllByRole("row").slice(1);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent("TS-001");
      expect(rows[1]).toHaveTextContent("TS-002");
      expect(rows[2]).toHaveTextContent("TS-010");
    });

    it("puts the largest first when ?sort=remainingValue&dir=desc", () => {
      mockSearchParams = new URLSearchParams("sort=remainingValue&dir=desc");
      render(<AssetsClient assets={[ASSET_A, ASSET_B, ASSET_C]} />);

      const rows = screen.getAllByRole("row").slice(1);
      expect(rows).toHaveLength(3);
      // Largest remainingValue (TS-002: 25.000.000đ) first, followed by TS-001 (4.000.000đ), then TS-010 (50.000đ)
      expect(rows[0]).toHaveTextContent("TS-002");
      expect(rows[1]).toHaveTextContent("TS-001");
      expect(rows[2]).toHaveTextContent("TS-010");
    });
  });
});
