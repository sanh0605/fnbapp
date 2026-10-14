// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { CashEntryForm } from "./CashEntryForm";
import { addCashEntry } from "../actions";
import type { DBCashEntry } from "@/types/db";

// Wave K5: the day box is the shared DayInput, whose calendar calls
// window.matchMedia on mount; jsdom has none. Same stub as CashTransferForm.test.tsx.
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
vi.mock("../actions", () => ({
  addCashEntry: vi.fn(),
  updateCashEntry: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

const CATEGORIES = [{ id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" }] as any;

describe("CashEntryForm amount field (BR-CASH-005)", () => {
  // BR-CASH-005: the amount box is MoneyInput -- a digits-only visible input
  // (no name, so the browser's numeric keypad shows but never submits a
  // dotted display value) plus a hidden input named "amount" carrying plain
  // digits for the server.
  it("gives a numeric keypad and submits plain digits, not the dotted display value", () => {
    render(<CashEntryForm categories={CATEGORIES} accounts={[]} />);
    const visible = screen.getByPlaceholderText("Ví dụ: 150,000") as HTMLInputElement;
    expect(visible.getAttribute("name")).toBeNull();
    expect(visible.getAttribute("inputMode")).toBe("numeric");

    fireEvent.change(visible, { target: { value: "150000" } });
    expect(visible.value).toBe("150,000");

    const hidden = document.querySelector('input[type="hidden"][name="amount"]') as HTMLInputElement;
    expect(hidden.value).toBe("150000");
  });
});

describe("CashEntryForm date default (M7)", () => {
  it("defaults the add form's date to the Saigon today passed in by the page", () => {
    render(<CashEntryForm categories={CATEGORIES} accounts={[]} today="2026-09-11" />);
    const dateInput = document.querySelector('input[name="entry_date"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2026-09-11");
  });

  it("keeps the edit form's own date rather than today", () => {
    const entry = { id: "CE-001", entry_date: "2026-07-15", category_id: "CFC-001", amount: 1000,
      payment_method: "CASH", bank_account_id: null, note: null, status: "ACTIVE" } as DBCashEntry;
    render(<CashEntryForm entry={entry} categories={CATEGORIES} accounts={[]} today="2026-09-11" />);
    const dateInput = document.querySelector('input[name="entry_date"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2026-07-15");
  });
});

describe("CashEntryForm on-page behaviour", () => {
  it("renders on page and Bỏ navigates to returnTo without saving", () => {
    render(
      <CashEntryForm
        categories={CATEGORIES}
        accounts={[]}
        today="2026-09-11"
        returnTo="/admin/finance?preset=LAST_MONTH"
      />
    );
    const dateInput = document.querySelector('input[name="entry_date"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2026-09-11");
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/finance?preset=LAST_MONTH");
  });
});

// Wave K5: the day box moves to the shared DayInput (typed dd/mm/yyyy or picked
// from the calendar). The server still receives entry_date as yyyy-mm-dd, and
// a day that is not a date is said under the box instead of being sent.
describe("CashEntryForm day box (wave K5)", () => {
  const dayBox = () => screen.getByLabelText(/^Ngày( \*)?$/) as HTMLInputElement;

  it("posts a typed 15/09/2026 as entry_date=2026-09-15", async () => {
    vi.mocked(addCashEntry).mockResolvedValue({ error: null } as never);
    const { container } = render(<CashEntryForm categories={CATEGORIES} accounts={[]} today="2026-10-08" />);
    fireEvent.change(dayBox(), { target: { value: "15/09/2026" } });
    fireEvent.blur(dayBox());
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => expect(addCashEntry).toHaveBeenCalled());
    const sent = vi.mocked(addCashEntry).mock.calls[0][0] as FormData;
    expect(sent.get("entry_date")).toBe("2026-09-15");
  });

  // Owner 2026-10-14: on a slow connection a second tap must not save a second row.
  it("after a successful save Lưu stays switched off until the page moves on, so a second tap saves nothing", async () => {
    vi.mocked(addCashEntry).mockClear();
    vi.mocked(addCashEntry).mockResolvedValue({ error: null } as never);
    const { container } = render(<CashEntryForm categories={CATEGORIES} accounts={[]} today="2026-10-08" />);
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    await Promise.resolve();
    expect(addCashEntry).toHaveBeenCalledTimes(1);
  });

  it("says a day that is not a date and sends nothing", async () => {
    vi.mocked(addCashEntry).mockClear();
    const { container } = render(<CashEntryForm categories={CATEGORIES} accounts={[]} today="2026-10-08" />);
    fireEvent.change(dayBox(), { target: { value: "32/13/2026" } });
    fireEvent.blur(dayBox());
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Ngày không hợp lệ")).toBeInTheDocument();
    expect(addCashEntry).not.toHaveBeenCalled();
  });
});
