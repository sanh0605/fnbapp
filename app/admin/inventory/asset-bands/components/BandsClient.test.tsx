// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import BandsClient from "./BandsClient";
import type { DBAssetDepreciationBand } from "@/types/db";

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
  usePathname: () => "/admin/inventory/asset-bands",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const BANDS: DBAssetDepreciationBand[] = [
  {
    id: "KH-001",
    min_unit_price: 0,
    max_unit_price: 200000,
    term_months: 12,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "KH-002",
    min_unit_price: 200000,
    max_unit_price: 500000,
    term_months: 24,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "KH-003",
    min_unit_price: 500000,
    max_unit_price: null,
    term_months: 36,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BandsClient", () => {
  it("renders 3 bands with id, range, and term, and phone rows with range title, term value, and id meta", () => {
    const { container } = render(<BandsClient bands={BANDS} canDelete={false} />);

    // Renders IDs
    expect(screen.getAllByText("KH-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KH-002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KH-003").length).toBeGreaterThan(0);

    // Renders price ranges
    expect(screen.getAllByText("Dưới 200,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Từ 200,000đ đến dưới 500,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Từ 500,000đ trở lên").length).toBeGreaterThan(0);

    // Renders terms
    expect(screen.getAllByText("12 tháng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("24 tháng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("36 tháng").length).toBeGreaterThan(0);

    // Phone rows (default sort: code, newest first): line 1 has range + term, line 2 has code, no "Đơn giá:" prefix
    const phone = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
    const phoneLinks = within(phone).getAllByRole("link");
    expect(phone.textContent).not.toContain("Đơn giá:");
    expect(phoneLinks[2].textContent).toBe("Dưới 200,000đ12 thángKH-001");
    expect(phoneLinks[1].textContent).toBe("Từ 200,000đ đến dưới 500,000đ24 thángKH-002");
    expect(phoneLinks[0].textContent).toBe("Từ 500,000đ trở lên36 thángKH-003");
  });

  it("row link carries returnTo to the detail page", () => {
    render(<BandsClient bands={BANDS} canDelete={false} />);

    const links = screen.getAllByRole("link");
    expect(
      links.some((l) =>
        l.getAttribute("href")?.includes("/admin/inventory/asset-bands/KH-001?returnTo=")
      )
    ).toBe(true);
    expect(
      links.some((l) =>
        l.getAttribute("href")?.includes("/admin/inventory/asset-bands/KH-002?returnTo=")
      )
    ).toBe(true);
    expect(
      links.some((l) =>
        l.getAttribute("href")?.includes("/admin/inventory/asset-bands/KH-003?returnTo=")
      )
    ).toBe(true);
  });

  it("links 'Sửa khung' to edit page with returnTo", () => {
    render(<BandsClient bands={BANDS} canDelete={false} />);

    const editLink = screen.getByRole("link", { name: "Sửa khung" });
    expect(editLink.getAttribute("href")).toContain("/admin/inventory/asset-bands/edit?returnTo=");
  });

  it("renders no checkboxes and no removal bin even when canDelete is true", () => {
    render(<BandsClient bands={BANDS} canDelete={true} />);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
  });

  it("renders empty state when bands list is empty", () => {
    render(<BandsClient bands={[]} canDelete={false} />);

    expect(screen.getByText("Chưa có khung khấu hao nào.")).toBeInTheDocument();
  });
});
