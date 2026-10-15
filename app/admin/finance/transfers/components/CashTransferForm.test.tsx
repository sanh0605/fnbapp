// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { CashTransferForm } from "./CashTransferForm";
import type { DBBankAccount, DBCashTransfer } from "@/types/db";

if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const { addCashTransferMock, updateCashTransferMock } = vi.hoisted(() => ({
  addCashTransferMock: vi.fn(),
  updateCashTransferMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  addCashTransfer: (...args: any[]) => addCashTransferMock(...args),
  updateCashTransfer: (...args: any[]) => updateCashTransferMock(...args),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  addCashTransferMock.mockResolvedValue({ ok: true });
  updateCashTransferMock.mockResolvedValue({ ok: true });
});

const ACCOUNTS: DBBankAccount[] = [
  {
    id: "BA-001",
    name: "ACB - Phin Di",
    bank_name: "ACB",
    account_number: "123456",
    status: "ACTIVE",
  } as unknown as DBBankAccount,
];

describe("CashTransferForm", () => {
  it("refuses same from and to before submit", async () => {
    render(<CashTransferForm accounts={ACCOUNTS} today="2026-10-04" />);

    // Select CASH for both
    const fromSelect = screen.getByLabelText(/^Từ( \*)?$/) as HTMLSelectElement;
    const toSelect = screen.getByLabelText(/^Đến( \*)?$/) as HTMLSelectElement;
    fireEvent.change(fromSelect, { target: { value: "CASH" } });
    fireEvent.change(toSelect, { target: { value: "CASH" } });

    // Fill amount
    const visibleAmount = screen.getByPlaceholderText("Ví dụ: 500,000");
    fireEvent.change(visibleAmount, { target: { value: "500000" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: "Tạo" });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText("Nơi chuyển và nơi nhận phải khác nhau"),
    ).toBeInTheDocument();
    expect(addCashTransferMock).not.toHaveBeenCalled();
  });

  it("submits valid transfer successfully", async () => {
    render(
      <CashTransferForm
        accounts={ACCOUNTS}
        today="2026-10-04"
        returnTo="/admin/finance?preset=THIS_MONTH"
      />,
    );

    const fromSelect = screen.getByLabelText(/^Từ( \*)?$/);
    const toSelect = screen.getByLabelText(/^Đến( \*)?$/);
    fireEvent.change(fromSelect, { target: { value: "CASH" } });
    fireEvent.change(toSelect, { target: { value: "BA-001" } });

    const visibleAmount = screen.getByPlaceholderText("Ví dụ: 500,000");
    fireEvent.change(visibleAmount, { target: { value: "500000" } });

    const submitBtn = screen.getByRole("button", { name: "Tạo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(addCashTransferMock).toHaveBeenCalledTimes(1);
    });
    expect(push).toHaveBeenCalledWith("/admin/finance?preset=THIS_MONTH");
  });

  // Owner 2026-10-14: on a slow connection a second tap must not save a second transfer.
  it("after a successful save Lưu stays switched off until the page moves on, so a second tap saves nothing", async () => {
    const { container } = render(
      <CashTransferForm accounts={ACCOUNTS} today="2026-10-04" returnTo="/admin/finance" />,
    );
    fireEvent.change(screen.getByLabelText(/^Từ( \*)?$/), { target: { value: "CASH" } });
    fireEvent.change(screen.getByLabelText(/^Đến( \*)?$/), { target: { value: "BA-001" } });
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: 500,000"), { target: { value: "500000" } });

    fireEvent.click(screen.getByRole("button", { name: "Tạo" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/finance"));

    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    await Promise.resolve();
    expect(addCashTransferMock).toHaveBeenCalledTimes(1);
  });

  it("defaults date to today for new and keeps transfer date for edit", () => {
    const { unmount } = render(
      <CashTransferForm accounts={ACCOUNTS} today="2026-10-04" />,
    );
    const dateInput = document.querySelector(
      'input[name="transfer_date"]',
    ) as HTMLInputElement;
    expect(dateInput.value).toBe("2026-10-04");
    unmount();

    const transfer: DBCashTransfer = {
      id: "CT-001",
      transfer_date: "2026-09-10",
      amount: 5000000,
      from_account_id: null,
      to_account_id: "BA-001",
      note: "Chuyển tiền vào tài khoản",
      status: "ACTIVE",
    } as unknown as DBCashTransfer;

    render(
      <CashTransferForm
        transfer={transfer}
        accounts={ACCOUNTS}
        today="2026-10-04"
      />,
    );
    const editDateInput = document.querySelector(
      'input[name="transfer_date"]',
    ) as HTMLInputElement;
    expect(editDateInput.value).toBe("2026-09-10");
  });

  it("navigates to returnTo when Bỏ is clicked", () => {
    render(
      <CashTransferForm
        accounts={ACCOUNTS}
        today="2026-10-04"
        returnTo="/admin/finance"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/finance");
    expect(addCashTransferMock).not.toHaveBeenCalled();
  });
});

// Wave K5: the day box moves to the shared DayInput. transfer_date still
// reaches the server as yyyy-mm-dd; a day that is not a date is said under the
// box and nothing is sent.
describe("CashTransferForm day box (wave K5)", () => {
  const dayBox = () => screen.getByLabelText(/^Ngày( \*)?$/) as HTMLInputElement;

  it("says a day that is not a date and sends nothing", async () => {
    const { container } = render(<CashTransferForm accounts={ACCOUNTS} today="2026-10-08" />);
    fireEvent.change(dayBox(), { target: { value: "32/13/2026" } });
    fireEvent.blur(dayBox());
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Ngày không hợp lệ")).toBeInTheDocument();
    expect(addCashTransferMock).not.toHaveBeenCalled();
  });
});
