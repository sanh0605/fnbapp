// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { BankAccountDetailView } from "./BankAccountDetailView";
import { setBankAccountStatus } from "@/app/admin/finance/bank-accounts/actions";
import type { DBBankAccount } from "@/types/db";

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

vi.mock("@/app/admin/finance/bank-accounts/actions", () => ({
  setBankAccountStatus: vi.fn(),
  deleteBankAccount: vi.fn(),
}));

vi.mock("@/lib/shared/dialog", () => ({
  confirm: vi.fn().mockResolvedValue(true),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const sampleAccount = {
  id: "BA-001",
  name: "ACB - Phin Di",
  bank_name: "ACB",
  account_number: "123456",
  status: "ACTIVE",
} as unknown as DBBankAccount;

describe("BankAccountDetailView", () => {
  it("renders fields properly", () => {
    render(
      <BankAccountDetailView
        account={sampleAccount}
        returnTo="/admin/finance/bank-accounts"
        canDelete={false}
      />,
    );

    expect(screen.getByText("BA-001")).toHaveClass("text-text-secondary");
    expect(screen.getAllByText("ACB - Phin Di").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ACB").length).toBeGreaterThan(0);
    expect(screen.getAllByText("123456").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mã")).toBeNull();
    expect(screen.queryByText("Tên")).toBeNull();
  });

  it("renders '—' for missing bank_name or account_number", () => {
    render(
      <BankAccountDetailView
        account={{ ...sampleAccount, bank_name: null, account_number: null }}
        returnTo="/admin/finance/bank-accounts"
        canDelete={false}
      />,
    );

    expect(screen.getAllByText("—").length).toBe(2);
  });

  it("shows Ngừng dùng button when status is ACTIVE", () => {
    render(
      <BankAccountDetailView
        account={sampleAccount}
        returnTo="/admin/finance/bank-accounts"
        canDelete={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Ngừng dùng" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dùng lại" })).toBeNull();
  });

  it("shows Dùng lại button and Ngừng dùng badge when status is INACTIVE", () => {
    render(
      <BankAccountDetailView
        account={{ ...sampleAccount, status: "INACTIVE" }}
        returnTo="/admin/finance/bank-accounts"
        canDelete={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Dùng lại" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ngừng dùng" })).toBeNull();
    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);
  });

  it("shows Xoá button only when canDelete is true", () => {
    const { unmount } = render(
      <BankAccountDetailView
        account={sampleAccount}
        returnTo="/admin/finance/bank-accounts"
        canDelete={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
    unmount();

    render(
      <BankAccountDetailView
        account={sampleAccount}
        returnTo="/admin/finance/bank-accounts"
        canDelete={true}
      />,
    );
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });

  it("displays actionError in Alert when status change fails", async () => {
    vi.mocked(setBankAccountStatus).mockResolvedValueOnce({ error: "Không đổi được trạng thái tài khoản" });

    render(
      <BankAccountDetailView
        account={sampleAccount}
        returnTo="/admin/finance/bank-accounts"
        canDelete={false}
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: "Ngừng dùng" });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText("Không đổi được trạng thái tài khoản")).toBeInTheDocument();
    });
  });
});
