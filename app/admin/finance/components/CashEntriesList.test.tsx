// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashEntriesList } from "./CashEntriesList";
import type { DBCashCategory, DBCashEntry } from "@/types/db";

// CashEntriesList calls useRouter().refresh() after a cancel/delete write --
// same pattern as app/admin/inventory/assets/components/AssetCard.test.tsx.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

const categories = [
  { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
  { id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false, status: "ACTIVE" },
] as DBCashCategory[];

const entries = [
  { id: "CE-001", entry_date: "2026-07-15", category_id: "CFC-001", amount: 1371000,
    payment_method: "CASH", bank_account_id: null, note: null, status: "ACTIVE",
    created_by_name: "Sanh" },
  { id: "CE-002", entry_date: "2026-07-16", category_id: "CFC-001", amount: 999000,
    payment_method: "CASH", bank_account_id: null, note: null, status: "CANCELLED",
    created_by_name: "Sanh" },
  { id: "CE-003", entry_date: "2026-07-17", category_id: "CFC-005", amount: 5000000,
    payment_method: "CASH", bank_account_id: null, note: null, status: "ACTIVE",
    created_by_name: "Sanh" },
] as DBCashEntry[];

const props = { entries, categories, accounts: [], canDelete: false };

describe("CashEntriesList", () => {
  it("shows a cancelled row rather than hiding it", () => {
    render(<CashEntriesList {...props} />);
    const table = within(screen.getByRole("table"));
    expect(table.getAllByText("Đã huỷ").length).toBe(1);
  });

  it("keeps the cancelled amount out of the totals", () => {
    render(<CashEntriesList {...props} />);
    expect(screen.getByTestId("total-expense")).toHaveTextContent("1.371.000");
    expect(screen.getByTestId("total-expense")).not.toHaveTextContent("2.370.000");
  });

  it("never prints a single combined number", () => {
    render(<CashEntriesList {...props} />);
    expect(screen.queryByTestId("total-net")).toBeNull();
  });

  it("calls out the income that is not revenue", () => {
    render(<CashEntriesList {...props} />);
    expect(screen.getByTestId("income-outside-pnl")).toHaveTextContent("5.000.000");
  });

  it("hides the permanent-delete button from anyone who is not ADMIN", () => {
    render(<CashEntriesList {...props} />);
    expect(screen.queryByRole("button", { name: /xoá hẳn/i })).toBeNull();
  });

  it("shows ADMIN a delete button on every row, and cancel only on live rows", () => {
    render(<CashEntriesList {...props} canDelete={true} />);
    const table = within(screen.getByRole("table"));
    expect(table.getAllByRole("button", { name: /xoá hẳn/i }).length).toBe(3);
    expect(table.getAllByRole("button", { name: /^huỷ$/i }).length).toBe(2);
  });

  it("says so plainly when the range holds nothing", () => {
    render(<CashEntriesList {...props} entries={[]} />);
    expect(screen.getByText("Chưa có khoản nào trong khoảng này")).toBeTruthy();
  });

  // M8 (final-review.md): "Thu ngoài lãi lỗ" reads as a third bucket when it
  // sits as a peer card next to Tổng thu/Tổng chi -- it is a sub-line of
  // Tổng thu, not a bucket of its own.
  it("shows only two summary cards, with the outside-P&L figure nested inside Tổng thu", () => {
    render(<CashEntriesList {...props} />);
    expect(screen.getByTestId("total-expense")).toBeTruthy();
    expect(screen.getByTestId("total-income")).toBeTruthy();
    const outside = screen.getByTestId("income-outside-pnl");
    expect(outside).toHaveTextContent("5.000.000");
    expect(screen.getByTestId("total-income").contains(outside)).toBe(true);
  });
});

// M2 (final-review.md): entries were listed in id order, not date order, so
// a backdated row landed in the wrong place on screen.
describe("CashEntriesList sort order", () => {
  const unsorted = [
    { id: "CE-001", entry_date: "2026-07-15", category_id: "CFC-001", amount: 1000,
      payment_method: "CASH", bank_account_id: null, note: null, status: "ACTIVE",
      created_by_name: "Sanh" },
    { id: "CE-060", entry_date: "2026-09-03", category_id: "CFC-001", amount: 2000,
      payment_method: "CASH", bank_account_id: null, note: null, status: "ACTIVE",
      created_by_name: "Sanh" },
    { id: "CE-030", entry_date: "2026-09-03", category_id: "CFC-001", amount: 3000,
      payment_method: "CASH", bank_account_id: null, note: null, status: "ACTIVE",
      created_by_name: "Sanh" },
  ] as DBCashEntry[];

  it("lists rows newest entry_date first, then id descending within the same date, on the desktop table", () => {
    render(<CashEntriesList entries={unsorted} categories={categories} accounts={[]} canDelete={false} />);
    const table = within(screen.getByRole("table"));
    const amounts = table.getAllByText(/^\d[\d.]*đ$/).map((el) => el.textContent);
    // Same entry_date (2026-09-03) for CE-060 and CE-030 -- id descending
    // puts the lexicographically larger id ("CE-060") first.
    expect(amounts).toEqual(["2.000đ", "3.000đ", "1.000đ"]);
  });

  it("lists rows in the same order on the phone cards", () => {
    render(<CashEntriesList entries={unsorted} categories={categories} accounts={[]} canDelete={false} />);
    const phone = within(screen.getByTestId("cash-entries-phone"));
    const amounts = phone.getAllByText(/^\d[\d.]*đ$/).map((el) => el.textContent);
    // Same entry_date (2026-09-03) for CE-060 and CE-030 -- id descending
    // puts the lexicographically larger id ("CE-060") first.
    expect(amounts).toEqual(["2.000đ", "3.000đ", "1.000đ"]);
  });
});

// M4 (final-review.md): byCategory and unknownCategoryIds were computed but
// never rendered -- the screen gave only the grand total, so the owner
// could not read off the July acceptance figures by category.
describe("CashEntriesList by-category breakdown", () => {
  it("shows one line per category with its Vietnamese name and amount", () => {
    render(<CashEntriesList {...props} />);
    const byCategory = screen.getByTestId("by-category");
    expect(byCategory).toHaveTextContent("Vận hành");
    expect(byCategory).toHaveTextContent("1.371.000");
    expect(byCategory).toHaveTextContent("Vốn góp");
    expect(byCategory).toHaveTextContent("5.000.000");
  });

  it("names an entry whose category is missing from the list, instead of dropping it silently", () => {
    const withUnknown = [
      ...entries,
      { id: "CE-004", entry_date: "2026-07-18", category_id: "CFC-999", amount: 1000,
        payment_method: "CASH", bank_account_id: null, note: null, status: "ACTIVE",
        created_by_name: "Sanh" } as DBCashEntry,
    ];
    render(<CashEntriesList entries={withUnknown} categories={categories} accounts={[]} canDelete={false} />);
    expect(screen.getByTestId("by-category")).toHaveTextContent(
      "Có dòng thuộc nhóm không còn trong danh sách",
    );
  });
});
