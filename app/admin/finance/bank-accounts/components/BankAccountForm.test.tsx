// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { BankAccountForm } from "./BankAccountForm";
import { updateBankAccount } from "../actions";
import type { DBBankAccount } from "@/types/db";

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
    expect(screen.getByLabelText(/^Tên gợi nhớ/)).toBeInTheDocument();
  });

  it("Bỏ navigates to returnTo without saving", () => {
    render(<BankAccountForm returnTo="/admin/finance/bank-accounts" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/finance/bank-accounts");
  });
});


// Wave K5 (plan Review Focus 2): the account number is a code, not a number.
// It moves to TextInput with the digit keypad, and must show and post the
// exact string typed -- a leading zero kept, no thousands commas.
describe("BankAccountForm account number keeps its leading zero (wave K5)", () => {
  const ACCOUNT: DBBankAccount = {
    id: "BA-1",
    name: "Vietcombank Sanh",
    bank_name: "Vietcombank",
    account_number: "0071001234567",
    status: "ACTIVE",
    created_at: "2026-10-01T00:00:00.000Z",
    created_by_id: null,
    created_by_name: null,
    updated_at: "2026-10-01T00:00:00.000Z",
    updated_by_id: null,
    updated_by_name: null,
  };

  it("shows 0071001234567 as stored, with the digit keypad", () => {
    render(<BankAccountForm account={ACCOUNT} />);
    const box = screen.getByLabelText(/^Số tài khoản/) as HTMLInputElement;
    expect(box.value).toBe("0071001234567");
    expect(box.getAttribute("inputmode")).toBe("numeric");
  });

  it("posts account_number=0071001234567 unchanged", async () => {
    vi.mocked(updateBankAccount).mockResolvedValue({ error: null } as never);
    render(<BankAccountForm account={ACCOUNT} />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await vi.waitFor(() => expect(updateBankAccount).toHaveBeenCalled());
    const sent = vi.mocked(updateBankAccount).mock.calls[0][0] as FormData;
    expect(sent.get("account_number")).toBe("0071001234567");
  });
});

describe("BankAccountForm submission guards", () => {
  it("prevents double submission on slow network", async () => {
    const { addBankAccount } = await import("../actions");
    vi.mocked(addBankAccount).mockClear();
    vi.mocked(addBankAccount).mockResolvedValue({} as any);

    const { container } = render(<BankAccountForm returnTo="/admin/finance/bank-accounts" />);
    fireEvent.change(screen.getByLabelText(/^Tên gợi nhớ/), { target: { value: "Tài khoản test" } });

    fireEvent.submit(container.querySelector("form")!);
    fireEvent.submit(container.querySelector("form")!);
    await Promise.resolve();

    expect(addBankAccount).toHaveBeenCalledTimes(1);
  });

  it("handles network error with friendly message in Alert", async () => {
    const { addBankAccount } = await import("../actions");
    vi.mocked(addBankAccount).mockClear();
    vi.mocked(addBankAccount).mockRejectedValue(new Error("Network down"));

    const { container } = render(<BankAccountForm returnTo="/admin/finance/bank-accounts" />);
    fireEvent.change(screen.getByLabelText(/^Tên gợi nhớ/), { target: { value: "Tài khoản test" } });

    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Không lưu được. Kiểm tra mạng rồi bấm lại.")).toBeInTheDocument();
  });
});
