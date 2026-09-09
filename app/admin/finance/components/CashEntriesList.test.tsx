// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CashEntriesList } from "./CashEntriesList";
import type { DBCashCategory, DBCashEntry } from "@/types/db";

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
    expect(screen.getAllByText("Đã huỷ").length).toBe(1);
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
    expect(screen.getAllByRole("button", { name: /xoá hẳn/i }).length).toBe(3);
    expect(screen.getAllByRole("button", { name: /^huỷ$/i }).length).toBe(2);
  });

  it("says so plainly when the range holds nothing", () => {
    render(<CashEntriesList {...props} entries={[]} />);
    expect(screen.getByText("Chưa có khoản nào trong khoảng này")).toBeTruthy();
  });
});
