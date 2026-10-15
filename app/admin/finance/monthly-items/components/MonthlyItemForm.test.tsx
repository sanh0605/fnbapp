// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { MonthlyItemForm } from "./MonthlyItemForm";
import { createMonthlyItem, updateMonthlyItem } from "../actions";
import type { DBCashCategory, DBMonthlyExpenseItem } from "@/types/db";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("../actions", () => ({
  createMonthlyItem: vi.fn().mockResolvedValue({ success: true }),
  updateMonthlyItem: vi.fn().mockResolvedValue({ success: true }),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.clearAllMocks();
});

const CATEGORIES: DBCashCategory[] = [
  { id: "CFC-001", name: "Chi phí cố định", kind: "EXPENSE", status: "ACTIVE", affects_pnl: true, is_sales_revenue: false },
  { id: "CFC-002", name: "Bán hàng", kind: "INCOME", status: "ACTIVE", affects_pnl: true, is_sales_revenue: true },
  { id: "CFC-003", name: "Chi phí cũ", kind: "EXPENSE", status: "INACTIVE", affects_pnl: true, is_sales_revenue: false },
] as DBCashCategory[];

const SAMPLE_ITEM: DBMonthlyExpenseItem = {
  id: "KCT-001",
  name: "Tiền điện",
  cash_category_id: "CFC-003", // points to inactive expense category
  status: "ACTIVE",
  created_at: "2026-10-14T09:00:00Z",
  created_by_id: "a-1",
  created_by_name: "Admin",
  updated_at: "2026-10-14T09:00:00Z",
  updated_by_id: "a-1",
  updated_by_name: "Admin",
};

describe("MonthlyItemForm", () => {
  it("renders fields on page without opening a dialog", () => {
    render(<MonthlyItemForm categories={CATEGORIES} returnTo="/admin/finance/monthly-items" />);
    expect(screen.getByLabelText(/^Tên khoản/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nhóm chi/)).toBeInTheDocument();
  });

  it("Bỏ navigates to returnTo without saving", () => {
    render(<MonthlyItemForm categories={CATEGORIES} returnTo="/admin/finance/monthly-items" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/finance/monthly-items");
    expect(createMonthlyItem).not.toHaveBeenCalled();
  });

  it("shows only ACTIVE expense categories for new item", () => {
    render(<MonthlyItemForm categories={CATEGORIES} />);
    const select = screen.getByLabelText(/^Nhóm chi/) as HTMLSelectElement;
    const optionValues = [...select.options].map((o) => o.value);
    // CFC-001 is ACTIVE EXPENSE -> included
    expect(optionValues).toContain("CFC-001");
    // CFC-002 is INCOME -> excluded
    expect(optionValues).not.toContain("CFC-002");
    // CFC-003 is INACTIVE EXPENSE -> excluded for new item
    expect(optionValues).not.toContain("CFC-003");
  });

  it("includes the edited item's own category even if inactive", () => {
    render(<MonthlyItemForm item={SAMPLE_ITEM} categories={CATEGORIES} />);
    const select = screen.getByLabelText(/^Nhóm chi/) as HTMLSelectElement;
    const optionValues = [...select.options].map((o) => o.value);
    expect(optionValues).toContain("CFC-001");
    expect(optionValues).toContain("CFC-003");
    expect(optionValues).not.toContain("CFC-002");
    expect(select.value).toBe("CFC-003");
  });

  it("create button says 'Tạo' on new form and 'Lưu thay đổi' on edit form", () => {
    const { unmount } = render(<MonthlyItemForm categories={CATEGORIES} />);
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    unmount();

    render(<MonthlyItemForm item={SAMPLE_ITEM} categories={CATEGORIES} />);
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
  });

  it("submits createMonthlyItem and stays disabled after success", async () => {
    vi.mocked(createMonthlyItem).mockResolvedValue({ success: true } as never);
    const { container } = render(<MonthlyItemForm categories={CATEGORIES} returnTo="/admin/finance/monthly-items" />);
    fireEvent.change(screen.getByLabelText(/^Tên khoản/), { target: { value: "Tiền mạng" } });
    fireEvent.change(screen.getByLabelText(/^Nhóm chi/), { target: { value: "CFC-001" } });
    fireEvent.submit(container.querySelector("form")!);

    await vi.waitFor(() => expect(createMonthlyItem).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith("/admin/finance/monthly-items");
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();

    // Second tap does nothing
    fireEvent.submit(container.querySelector("form")!);
    expect(createMonthlyItem).toHaveBeenCalledTimes(1);
  });

  it("submits updateMonthlyItem with id on edit", async () => {
    vi.mocked(updateMonthlyItem).mockResolvedValue({ success: true } as never);
    const { container } = render(<MonthlyItemForm item={SAMPLE_ITEM} categories={CATEGORIES} />);
    fireEvent.submit(container.querySelector("form")!);

    await vi.waitFor(() => expect(updateMonthlyItem).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(updateMonthlyItem).mock.calls[0][0] as FormData;
    expect(formData.get("id")).toBe("KCT-001");
  });

  it("displays server error in role='alert' and re-enables submit button", async () => {
    vi.mocked(createMonthlyItem).mockResolvedValue({ error: "Tên khoản chi đã có" } as never);
    const { container } = render(<MonthlyItemForm categories={CATEGORIES} />);
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Tên khoản chi đã có");
    expect(screen.getByRole("button", { name: "Tạo" })).not.toBeDisabled();
  });

  it("handles thrown network error with expected Vietnamese message", async () => {
    vi.mocked(createMonthlyItem).mockRejectedValue(new Error("network error"));
    const { container } = render(<MonthlyItemForm categories={CATEGORIES} />);
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không lưu được. Kiểm tra mạng rồi bấm lại.",
    );
    expect(screen.getByRole("button", { name: "Tạo" })).not.toBeDisabled();
  });
});
