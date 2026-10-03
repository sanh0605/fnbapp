// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import BankAccountsClient from "./BankAccountsClient";
import type { DBBankAccount } from "@/types/db";

const { replace, refresh, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    router: { replace: replaceFn, refresh: refreshFn },
  };
});

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/finance/bank-accounts",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
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
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleAccounts = [
  {
    id: "BA-001",
    name: "ACB - Phin Di",
    bank_name: "ACB",
    account_number: "123456",
    status: "ACTIVE",
  },
  {
    id: "BA-002",
    name: "Vietcombank Sanh",
    bank_name: "Vietcombank",
    account_number: "987654",
    status: "INACTIVE",
  },
] as unknown as DBBankAccount[];

describe("BankAccountsClient", () => {
  it("renders no 'Sửa' or '/edit' link", () => {
    render(<BankAccountsClient accounts={sampleAccounts} />);

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("renders row link starting with /admin/finance/bank-accounts/BA-001?returnTo=", () => {
    render(<BankAccountsClient accounts={sampleAccounts} />);

    const allLinks = screen.getAllByRole("link");
    const baLinks = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/finance/bank-accounts/BA-001?returnTo="),
    );
    expect(baLinks.length).toBeGreaterThan(0);
  });

  it("renders bin labelled 'Ngừng dùng' when status is ACTIVE and hides it when status=INACTIVE", () => {
    const { unmount } = render(<BankAccountsClient accounts={sampleAccounts} />);

    const binButtons = screen.getAllByRole("button", { name: /^Ngừng dùng/i });
    expect(binButtons.length).toBeGreaterThan(0);
    unmount();

    mockSearchParams = new URLSearchParams("status=INACTIVE");
    render(<BankAccountsClient accounts={sampleAccounts} initialStatus="INACTIVE" />);

    expect(screen.queryByRole("button", { name: /^Ngừng dùng/i })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("'Tất cả' shows both active and inactive accounts", () => {
    mockSearchParams = new URLSearchParams("status=ALL");
    render(<BankAccountsClient accounts={sampleAccounts} initialStatus="ALL" />);

    expect(screen.getAllByText("ACB - Phin Di").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vietcombank Sanh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);
  });

  it("renders in default order newest code first (BA-002 before BA-001)", () => {
    mockSearchParams = new URLSearchParams("status=ALL");
    render(<BankAccountsClient accounts={sampleAccounts} initialStatus="ALL" />);

    const codes = screen.getAllByText(/^BA-00[12]$/).map((el) => el.textContent);
    const idx002 = codes.indexOf("BA-002");
    const idx001 = codes.indexOf("BA-001");
    expect(idx002).toBeGreaterThan(-1);
    expect(idx001).toBeGreaterThan(-1);
    expect(idx002).toBeLessThan(idx001);
  });
});
