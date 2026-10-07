// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { BandDetailView } from "./BandDetailView";
import type { DBAssetDepreciationBand } from "@/types/db";
import { deleteAssetBand } from "../../actions";
import { confirm } from "@/lib/shared/dialog";

const { push, refresh, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    push: pushFn,
    refresh: refreshFn,
    router: { push: pushFn, refresh: refreshFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/inventory/asset-bands/KH-001",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../actions", () => ({
  deleteAssetBand: vi.fn(),
}));

vi.mock("@/app/admin/inventory/asset-bands/actions", () => ({
  deleteAssetBand: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn(),
}));

const BAND: DBAssetDepreciationBand = {
  id: "KH-001",
  min_unit_price: 0,
  max_unit_price: 200000,
  term_months: 12,
  status: "ACTIVE",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BandDetailView", () => {
  it("renders band details, title and back link", () => {
    const returnTo = "/admin/inventory/asset-bands";
    render(<BandDetailView band={BAND} returnTo={returnTo} canDelete={false} />);

    // Header back link
    const backLink = screen.getByRole("link", { name: /Thời hạn khấu hao/ });
    expect(backLink).toHaveAttribute("href", returnTo);

    // Title = formatBandRange(band)
    expect(screen.getAllByText("Dưới 200,000đ").length).toBeGreaterThan(0);

    // Fields: Mã, Đơn giá, Số tháng khấu hao, and note
    expect(screen.getAllByText("KH-001").length).toBeGreaterThan(0);
    expect(screen.getByText("12 tháng")).toBeInTheDocument();
    expect(
      screen.getByText("Sửa khung chỉ áp dụng cho tài sản mua sau đó.")
    ).toBeInTheDocument();
  });

  it("'Chỉnh sửa' href goes to /edit with returnTo = detail url", () => {
    const returnTo = "/admin/inventory/asset-bands";
    render(<BandDetailView band={BAND} returnTo={returnTo} canDelete={false} />);

    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    const detailUrl = `/admin/inventory/asset-bands/${BAND.id}?returnTo=${encodeURIComponent(returnTo)}`;
    const expectedEditHref = `/admin/inventory/asset-bands/${BAND.id}/edit?returnTo=${encodeURIComponent(detailUrl)}`;

    expect(editLink).toHaveAttribute("href", expectedEditHref);
  });

  it("hides 'Xoá' button when canDelete is false", () => {
    render(<BandDetailView band={BAND} returnTo="/admin/inventory/asset-bands" canDelete={false} />);
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
  });

  it("renders 'Xoá' button when canDelete is true", () => {
    render(<BandDetailView band={BAND} returnTo="/admin/inventory/asset-bands" canDelete={true} />);
    expect(screen.getByRole("button", { name: /Xoá/ })).toBeInTheDocument();
  });

  it("calls deleteAssetBand when delete button is clicked and confirmed", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(deleteAssetBand).mockResolvedValue({ ok: true });

    render(<BandDetailView band={BAND} returnTo="/admin/inventory/asset-bands" canDelete={true} />);

    const deleteBtn = screen.getByRole("button", { name: /Xoá/ });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteAssetBand).toHaveBeenCalled();
    });
  });
});
