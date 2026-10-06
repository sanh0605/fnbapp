// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import BandsClient from "./BandsClient";
import type { DBAssetDepreciationBand } from "@/types/db";
import { deleteAssetBand } from "../actions";
import { confirm } from "@/lib/shared/dialog";

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

vi.mock("../actions", () => ({
  deleteAssetBand: vi.fn(),
}));

vi.mock("@/app/admin/inventory/asset-bands/actions", () => ({
  deleteAssetBand: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn(),
}));

const BANDS: DBAssetDepreciationBand[] = [
  {
    id: "KH-001",
    min_unit_price: 0,
    max_unit_price: 200000,
    term_months: 12,
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "KH-002",
    min_unit_price: 200000,
    max_unit_price: 500000,
    term_months: 24,
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "KH-003",
    min_unit_price: 500000,
    max_unit_price: null,
    term_months: 36,
    status: "ACTIVE",
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
  it("renders 3 bands with id, range, and term", () => {
    render(<BandsClient bands={BANDS} canDelete={false} />);

    // Renders IDs
    expect(screen.getAllByText("KH-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KH-002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KH-003").length).toBeGreaterThan(0);

    // Renders price ranges
    expect(screen.getAllByText("Dưới 200.000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Từ 200.000đ đến dưới 500.000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Từ 500.000đ trở lên").length).toBeGreaterThan(0);

    // Renders terms
    expect(screen.getAllByText("12 tháng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("24 tháng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("36 tháng").length).toBeGreaterThan(0);
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

  it("does not render any 'Sửa' link", () => {
    render(<BandsClient bands={BANDS} canDelete={false} />);

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    expect(screen.queryByText("Sửa")).toBeNull();
  });

  it("links 'Tạo' to new page with returnTo", () => {
    render(<BandsClient bands={BANDS} canDelete={false} />);

    const addLink = screen.getByRole("link", { name: "Tạo" });
    expect(addLink.getAttribute("href")).toContain("/admin/inventory/asset-bands/new?returnTo=");
  });

  it("non-ADMIN (canDelete=false) renders no checkboxes and no removal bin", () => {
    render(<BandsClient bands={BANDS} canDelete={false} />);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
  });

  it("ADMIN (canDelete=true) sees bin and checkboxes", () => {
    render(<BandsClient bands={BANDS} canDelete={true} />);

    expect(screen.queryAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: /Xoá/ }).length).toBeGreaterThan(0);
  });

  it("calls deleteAssetBand when deleting a band", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(deleteAssetBand).mockResolvedValue({ ok: true });

    render(<BandsClient bands={BANDS} canDelete={true} />);

    const deleteBtn = screen.getAllByRole("button", { name: /Xoá/ })[0];
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteAssetBand).toHaveBeenCalled();
    });
  });

  it("shows refusal message when deleting a band fails", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const refusalMessage = "Không thể xoá: Phải có ít nhất một khung khấu hao";
    vi.mocked(deleteAssetBand).mockResolvedValue({ error: refusalMessage });

    render(<BandsClient bands={BANDS} canDelete={true} />);

    const deleteBtn = screen.getAllByRole("button", { name: /Xoá/ })[0];
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteAssetBand).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(refusalMessage)).toBeInTheDocument();
    });
  });

  it("renders empty state when bands list is empty", () => {
    render(<BandsClient bands={[]} canDelete={false} />);

    expect(screen.getByText("Chưa có khung khấu hao nào.")).toBeInTheDocument();
  });
});
