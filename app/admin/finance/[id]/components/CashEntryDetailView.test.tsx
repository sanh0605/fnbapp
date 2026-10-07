// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { CashEntryDetailView } from "./CashEntryDetailView";
import type { DBCashCategory, DBCashEntry, DBBankAccount } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/finance/actions", () => ({
  cancelCashEntry: vi.fn(),
  deleteCashEntry: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const sampleCategories = [
  { id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false, status: "ACTIVE" },
] as unknown as DBCashCategory[];

const sampleAccounts = [] as unknown as DBBankAccount[];

const sampleEntry = {
  id: "CE-040",
  entry_date: "2026-09-30",
  category_id: "CFC-005",
  amount: 2443400,
  payment_method: "CASH",
  bank_account_id: null,
  note: "Góp vốn tháng 9",
  status: "ACTIVE",
  created_by_name: "admin",
  created_at: "2026-09-30T10:30:00Z",
} as unknown as DBCashEntry;

describe("CashEntryDetailView", () => {
  it("renders fields properly including formatted amount '2,443,400đ'", () => {
    render(
      <CashEntryDetailView
        entry={sampleEntry}
        categories={sampleCategories}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );

    expect(screen.getAllByText("CE-040").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30/09/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vốn góp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Thu").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2,443,400đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tiền mặt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Góp vốn tháng 9").length).toBeGreaterThan(0);
    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);
  });

  it("shows Chỉnh sửa and Huỷ buttons when entry is not cancelled", () => {
    render(
      <CashEntryDetailView
        entry={sampleEntry}
        categories={sampleCategories}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );

    expect(screen.getByRole("link", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeInTheDocument();
  });

  it("hides Chỉnh sửa and Huỷ buttons when entry is cancelled, and displays badge 'Đã huỷ'", () => {
    render(
      <CashEntryDetailView
        entry={{ ...sampleEntry, status: "CANCELLED" }}
        categories={sampleCategories}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );

    expect(screen.queryByRole("link", { name: "Chỉnh sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Huỷ" })).toBeNull();
    expect(screen.getAllByText("Đã huỷ").length).toBeGreaterThan(0);
  });

  it("shows Xoá hẳn only when canDelete is true", () => {
    const { unmount } = render(
      <CashEntryDetailView
        entry={sampleEntry}
        categories={sampleCategories}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Xoá hẳn" })).toBeNull();
    unmount();

    render(
      <CashEntryDetailView
        entry={sampleEntry}
        categories={sampleCategories}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={true}
      />,
    );
    expect(screen.getByRole("button", { name: "Xoá hẳn" })).toBeInTheDocument();
  });
});
