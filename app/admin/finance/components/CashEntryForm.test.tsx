// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashEntryForm } from "./CashEntryForm";
import type { DBCashEntry } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../actions", () => ({
  addCashEntry: vi.fn(),
  updateCashEntry: vi.fn(),
}));

afterEach(cleanup);

const CATEGORIES = [{ id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" }] as any;

describe("CashEntryForm amount field (BR-CASH-005)", () => {
  // BR-CASH-005: the amount box is MoneyInput -- a digits-only visible input
  // (no name, so the browser's numeric keypad shows but never submits a
  // dotted display value) plus a hidden input named "amount" carrying plain
  // digits for the server.
  it("gives a numeric keypad and submits plain digits, not the dotted display value", () => {
    render(<CashEntryForm categories={CATEGORIES} accounts={[]} />);
    fireEvent.click(screen.getByText("+ Ghi khoản mới"));
    const visible = screen.getByPlaceholderText("VD: 150.000") as HTMLInputElement;
    expect(visible.getAttribute("name")).toBeNull();
    expect(visible.getAttribute("inputMode")).toBe("numeric");

    fireEvent.change(visible, { target: { value: "150000" } });
    expect(visible.value).toBe("150.000");

    const hidden = document.querySelector('input[type="hidden"][name="amount"]') as HTMLInputElement;
    expect(hidden.value).toBe("150000");
  });
});

describe("CashEntryForm date default (M7)", () => {
  it("defaults the add form's date to the Saigon today passed in by the page", () => {
    render(<CashEntryForm categories={CATEGORIES} accounts={[]} today="2026-09-11" />);
    fireEvent.click(screen.getByText("+ Ghi khoản mới"));
    const dateInput = document.querySelector('input[name="entry_date"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2026-09-11");
  });

  it("keeps the edit form's own date rather than today", () => {
    const entry = { id: "CE-001", entry_date: "2026-07-15", category_id: "CFC-001", amount: 1000,
      payment_method: "CASH", bank_account_id: null, note: null, status: "ACTIVE" } as DBCashEntry;
    render(<CashEntryForm entry={entry} categories={CATEGORIES} accounts={[]} today="2026-09-11" />);
    fireEvent.click(screen.getByText("Sửa"));
    const dateInput = document.querySelector('input[name="entry_date"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2026-07-15");
  });
});
