// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { BankAccountDetailView } from "./BankAccountDetailView";
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

    expect(screen.getAllByText("BA-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ACB - Phin Di").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ACB").length).toBeGreaterThan(0);
    expect(screen.getAllByText("123456").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);
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

  it("shows Xoá hẳn button only when canDelete is true", () => {
    const { unmount } = render(
      <BankAccountDetailView
        account={sampleAccount}
        returnTo="/admin/finance/bank-accounts"
        canDelete={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Xoá hẳn" })).toBeNull();
    unmount();

    render(
      <BankAccountDetailView
        account={sampleAccount}
        returnTo="/admin/finance/bank-accounts"
        canDelete={true}
      />,
    );
    expect(screen.getByRole("button", { name: "Xoá hẳn" })).toBeInTheDocument();
  });
});
