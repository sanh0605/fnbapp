// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { BankAccountForm } from "./BankAccountForm";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("../actions", () => ({
  addBankAccount: vi.fn(),
  updateBankAccount: vi.fn(),
  setBankAccountStatus: vi.fn(),
  deleteBankAccount: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

// M6 (final-review.md): account numbers are digits, so the phone rule
// (.claude/rules/ui-devices.md: inputMode="numeric" on every numeric input)
// applies -- but type stays "text" so a leading zero in the account number
// survives.
describe("BankAccountForm account number field (M6)", () => {
  it("keeps type=text but adds inputMode=numeric", () => {
    render(<BankAccountForm />);
    const input = document.querySelector('input[name="account_number"]') as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputMode")).toBe("numeric");
  });
});

describe("BankAccountForm on-page behaviour", () => {
  it("renders fields on the page without opening a dialog", () => {
    render(<BankAccountForm returnTo="/admin/finance/bank-accounts" />);
    expect(screen.getByLabelText("Tên gợi nhớ")).toBeInTheDocument();
  });

  it("Bỏ navigates to returnTo without saving", () => {
    render(<BankAccountForm returnTo="/admin/finance/bank-accounts" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/finance/bank-accounts");
  });
});

