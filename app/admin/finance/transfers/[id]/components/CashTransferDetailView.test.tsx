// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { CashTransferDetailView } from "./CashTransferDetailView";
import type { DBBankAccount, DBCashTransfer } from "@/types/db";

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

const { cancelCashTransferMock, deleteCashTransferMock, confirmMock } =
  vi.hoisted(() => ({
    cancelCashTransferMock: vi.fn(),
    deleteCashTransferMock: vi.fn(),
    confirmMock: vi.fn(),
  }));

vi.mock("@/app/admin/finance/transfers/actions", () => ({
  cancelCashTransfer: (...args: any[]) => cancelCashTransferMock(...args),
  deleteCashTransfer: (...args: any[]) => deleteCashTransferMock(...args),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: (...args: any[]) => confirmMock(...args),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
  cancelCashTransferMock.mockResolvedValue({ ok: true });
  deleteCashTransferMock.mockResolvedValue({ ok: true });
  confirmMock.mockResolvedValue(true);
});

const sampleAccounts: DBBankAccount[] = [
  {
    id: "BA-001",
    name: "ACB - Phin Di",
    bank_name: "ACB",
    account_number: "123456",
    status: "ACTIVE",
  } as unknown as DBBankAccount,
];

const sampleTransfer: DBCashTransfer = {
  id: "CT-001",
  transfer_date: "2026-09-10",
  amount: 5000000,
  from_account_id: null,
  to_account_id: "BA-001",
  note: "Chuyển tiền két vào ACB",
  status: "ACTIVE",
  created_by_name: "admin",
} as unknown as DBCashTransfer;

describe("CashTransferDetailView", () => {
  it("renders fields properly including Mã, Ngày, Số tiền, Từ, Đến, Ghi chú, Trạng thái, Người tạo", () => {
    render(
      <CashTransferDetailView
        transfer={sampleTransfer}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );

    expect(screen.getAllByText("CT-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10/09/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5,000,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tiền mặt (két)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ACB - Phin Di").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chuyển tiền két vào ACB").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
  });

  it("shows Chỉnh sửa and Huỷ buttons when transfer is active", () => {
    render(
      <CashTransferDetailView
        transfer={sampleTransfer}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );

    expect(screen.getByRole("link", { name: "Chỉnh sửa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeInTheDocument();
  });

  it("detail hides Huỷ and Chỉnh sửa on a cancelled row, and shows Đã huỷ badge", () => {
    render(
      <CashTransferDetailView
        transfer={{ ...sampleTransfer, status: "CANCELLED" }}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );

    expect(screen.queryByRole("link", { name: "Chỉnh sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Huỷ" })).toBeNull();
    expect(screen.getAllByText("Đã huỷ").length).toBeGreaterThan(0);
  });

  it("MANAGER sees no Xoá (canDelete=false)", () => {
    render(
      <CashTransferDetailView
        transfer={sampleTransfer}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Xoá/i })).toBeNull();
  });

  it("ADMIN sees Xoá (canDelete=true)", () => {
    render(
      <CashTransferDetailView
        transfer={sampleTransfer}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={true}
      />,
    );

    expect(screen.getByRole("button", { name: /^Xoá/i })).toBeInTheDocument();
  });

  it("clicking Huỷ prompts confirmation and calls cancelCashTransfer", async () => {
    render(
      <CashTransferDetailView
        transfer={sampleTransfer}
        accounts={sampleAccounts}
        returnTo="/admin/finance"
        canDelete={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Huỷ dòng chuyển tiền này? Số dư sẽ tính lại.",
      }),
    );

    await waitFor(() => {
      expect(cancelCashTransferMock).toHaveBeenCalledTimes(1);
    });
    expect(refresh).toHaveBeenCalled();
  });
});
