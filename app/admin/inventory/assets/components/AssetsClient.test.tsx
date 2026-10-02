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

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
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
});
