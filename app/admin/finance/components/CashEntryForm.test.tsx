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

describe("CashEntryForm amount field (I1)", () => {
  // A number input treats "150.000" as the float 150 and submits 150 --
  // the server never even sees the string it needs to validate. Text with
  // inputMode="numeric" still gives the numeric keypad on phone.
  it("is a text input, not a number input, so the browser never reinterprets a Vietnamese thousands-dot amount", () => {
    render(<CashEntryForm categories={CATEGORIES} accounts={[]} />);
    fireEvent.click(screen.getByText("+ Ghi khoản mới"));
    const amountInput = document.querySelector('input[name="amount"]') as HTMLInputElement;
    expect(amountInput.type).toBe("text");
    expect(amountInput.getAttribute("inputMode")).toBe("numeric");
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
