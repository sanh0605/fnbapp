// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { MonthlyItemDetailView } from "./MonthlyItemDetailView";
import { setMonthlyItemStatus, deleteMonthlyItem } from "../../actions";
import type { DBCashCategory, DBMonthlyExpenseItem } from "@/types/db";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../actions", () => ({
  setMonthlyItemStatus: vi.fn().mockResolvedValue({ success: true }),
  deleteMonthlyItem: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn().mockResolvedValue(true),
  alert: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.clearAllMocks();
});

const CATEGORY: DBCashCategory = {
  id: "CFC-001",
  name: "Chi phí cố định",
  kind: "EXPENSE",
  status: "ACTIVE",
  affects_pnl: true,
  is_sales_revenue: false,
} as DBCashCategory;

const SAMPLE_ITEM: DBMonthlyExpenseItem = {
  id: "KCT-001",
  name: "Tiền điện",
  cash_category_id: "CFC-001",
  status: "ACTIVE",
  created_at: "2026-10-14T09:00:00Z",
  created_by_id: "a-1",
  created_by_name: "Admin",
  updated_at: "2026-10-14T09:00:00Z",
  updated_by_id: "a-1",
  updated_by_name: "Admin",
};

describe("MonthlyItemDetailView", () => {
  it("renders detail fields properly", () => {
    render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={3}
        canDelete={false}
        returnTo="/admin/finance/monthly-items"
      />,
    );

    expect(screen.getByText("KCT-001")).toHaveClass("text-text-secondary");
    expect(screen.getByRole("heading", { level: 1, name: "Tiền điện" })).toBeInTheDocument();
    expect(screen.queryByText("Tên khoản")).toBeNull();
    expect(screen.getAllByText("Tiền điện").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chi phí cố định").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 dòng").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mã")).toBeNull();
  });

  it("shows Chỉnh sửa button linking to edit page", () => {
    render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={0}
        canDelete={true}
        returnTo="/admin/finance/monthly-items"
      />,
    );

    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink.getAttribute("href")).toContain("/admin/finance/monthly-items/KCT-001/edit");
  });

  it("shows Ngừng dùng button when ACTIVE and asks confirm before toggling status", async () => {
    const { confirm } = await import("@/lib/shared/dialog");
    vi.mocked(confirm).mockResolvedValue(true);

    render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={3}
        canDelete={false}
        returnTo="/admin/finance/monthly-items"
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: "Ngừng dùng" });
    fireEvent.click(toggleBtn);
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(setMonthlyItemStatus).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(setMonthlyItemStatus).mock.calls[0][0] as FormData;
    expect(formData.get("id")).toBe("KCT-001");
    expect(formData.get("status")).toBe("INACTIVE");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows Dùng lại button when INACTIVE and asks confirm before toggling status", async () => {
    const { confirm } = await import("@/lib/shared/dialog");
    vi.mocked(confirm).mockResolvedValue(true);

    render(
      <MonthlyItemDetailView
        item={{ ...SAMPLE_ITEM, status: "INACTIVE" }}
        category={CATEGORY}
        entryCount={0}
        canDelete={false}
        returnTo="/admin/finance/monthly-items"
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: "Dùng lại" });
    fireEvent.click(toggleBtn);
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(setMonthlyItemStatus).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(setMonthlyItemStatus).mock.calls[0][0] as FormData;
    expect(formData.get("status")).toBe("ACTIVE");
  });

  it("shows Xoá button only when canDelete is true AND entryCount is 0", () => {
    const { unmount } = render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={5}
        canDelete={true}
        returnTo="/admin/finance/monthly-items"
      />,
    );
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
    unmount();

    const { unmount: unmount2 } = render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={0}
        canDelete={false}
        returnTo="/admin/finance/monthly-items"
      />,
    );
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
    unmount2();

    render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={0}
        canDelete={true}
        returnTo="/admin/finance/monthly-items"
      />,
    );
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });

  it("clicking Xoá confirms with dialog, and cancelling does not delete", async () => {
    const { confirm } = await import("@/lib/shared/dialog");
    vi.mocked(confirm).mockResolvedValue(false);

    render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={0}
        canDelete={true}
        returnTo="/admin/finance/monthly-items"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(deleteMonthlyItem).not.toHaveBeenCalled();
  });

  it("confirming delete calls deleteMonthlyItem and navigates to returnTo on success", async () => {
    const { confirm } = await import("@/lib/shared/dialog");
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(deleteMonthlyItem).mockResolvedValue({ success: true } as never);

    render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={0}
        canDelete={true}
        returnTo="/admin/finance/monthly-items"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));

    await vi.waitFor(() => expect(deleteMonthlyItem).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(deleteMonthlyItem).mock.calls[0][0] as FormData;
    expect(formData.get("id")).toBe("KCT-001");
    expect(push).toHaveBeenCalledWith("/admin/finance/monthly-items");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows server refusal error in role='alert' when delete is refused", async () => {
    const { confirm } = await import("@/lib/shared/dialog");
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(deleteMonthlyItem).mockResolvedValue({
      error: "Khoản này đã có dòng trong sổ thu chi, chỉ ngừng dùng được.",
    } as never);

    render(
      <MonthlyItemDetailView
        item={SAMPLE_ITEM}
        category={CATEGORY}
        entryCount={0}
        canDelete={true}
        returnTo="/admin/finance/monthly-items"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Khoản này đã có dòng trong sổ thu chi, chỉ ngừng dùng được.",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
