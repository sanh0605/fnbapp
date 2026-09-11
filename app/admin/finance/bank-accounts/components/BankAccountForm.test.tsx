// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BankAccountForm } from "./BankAccountForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../actions", () => ({
  addBankAccount: vi.fn(),
  updateBankAccount: vi.fn(),
}));

afterEach(cleanup);

// M6 (final-review.md): account numbers are digits, so the phone rule
// (.claude/rules/ui-devices.md: inputMode="numeric" on every numeric input)
// applies -- but type stays "text" so a leading zero in the account number
// survives.
describe("BankAccountForm account number field (M6)", () => {
  it("keeps type=text but adds inputMode=numeric", () => {
    render(<BankAccountForm />);
    fireEvent.click(screen.getByText("+ Thêm tài khoản"));
    const input = document.querySelector('input[name="account_number"]') as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputMode")).toBe("numeric");
  });
});
