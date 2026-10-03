// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import CashBookClient from "./CashBookClient";
import type { DBCashCategory, DBCashEntry, DBBankAccount } from "@/types/db";

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
  usePathname: () => "/admin/finance",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/finance/actions", () => ({
  cancelCashEntry: vi.fn(),
  deleteCashEntry: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleCategories = [
  { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
  { id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false, status: "ACTIVE" },
  { id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", affects_pnl: true, status: "ACTIVE" },
] as unknown as DBCashCategory[];

const sampleAccounts = [
  { id: "BA-001", name: "ACB - Phin Di", bank_name: "ACB", account_number: "123456", status: "ACTIVE" },
] as unknown as DBBankAccount[];

// Generate 25 fixture rows to test 21+ items (pagination is 20 per page)
// Includes CE-040, CE-032 (dated 2026-09-02), CE-034 (dated 2026-04-30), and cancelled rows
const sampleEntries = [
  {
    id: "CE-040",
    entry_date: "2026-09-30",
    category_id: "CFC-005",
    amount: 2443400,
    payment_method: "CASH",
    bank_account_id: null,
    note: "Vốn góp đợt mới",
    status: "ACTIVE",
    created_by_name: "admin",
  },
  {
    id: "CE-032",
    entry_date: "2026-09-02",
    category_id: "CFC-001",
    amount: 1500000,
    payment_method: "CASH",
    bank_account_id: null,
    note: "Tiền điện",
    status: "ACTIVE",
    created_by_name: "admin",
  },
  {
    id: "CE-034",
    entry_date: "2026-04-30",
    category_id: "CFC-006",
    amount: 6683290,
    payment_method: "BANK_TRANSFER",
    bank_account_id: "BA-001",
    note: "Doanh thu bị mất dữ liệu",
    status: "ACTIVE",
    created_by_name: "admin",
  },
  {
    id: "CE-020",
    entry_date: "2026-08-01",
    category_id: "CFC-001",
    amount: 500000,
    payment_method: "CASH",
    bank_account_id: null,
    note: "Khoản đã huỷ",
    status: "CANCELLED",
    created_by_name: "admin",
  },
  ...Array.from({ length: 21 }, (_, i) => {
    const num = i + 50; // CE-050.. so generated codes never collide with the named rows
    const id = `CE-${num.toString().padStart(3, "0")}`;
    return {
      id,
      entry_date: `2026-08-${(10 + (i % 15)).toString().padStart(2, "0")}`,
      category_id: "CFC-001",
      amount: 100000,
      payment_method: "CASH" as const,
      bank_account_id: null,
      note: `Chi phí ${num}`,
      status: "ACTIVE" as const,
      created_by_name: "admin",
    };
  }),
] as unknown as DBCashEntry[];

const defaultProps = {
  entries: sampleEntries,
  categories: sampleCategories,
  accounts: sampleAccounts,
  canDelete: true,
  today: "2026-10-03",
  resolvedRange: {
    preset: "THIS_MONTH" as const,
    start: "2026-09-01",
    end: "2026-09-30",
  },
};

describe("CashBookClient", () => {
  it("renders no 'Sửa' or '/edit' link", () => {
    render(<CashBookClient {...defaultProps} />);

    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("renders row link starting with /admin/finance/CE-040?returnTo=", () => {
    render(<CashBookClient {...defaultProps} />);

    const allLinks = screen.getAllByRole("link");
    const ce40Links = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/finance/CE-040?returnTo="),
    );
    expect(ce40Links.length).toBeGreaterThan(0);
  });

  it("bin 'Huỷ' is present under default status (ACTIVE) and absent with status=CANCELLED", () => {
    const { unmount } = render(<CashBookClient {...defaultProps} />);

    const binButtons = screen.getAllByRole("button", { name: /^Huỷ/i });
    expect(binButtons.length).toBeGreaterThan(0);
    unmount();

    mockSearchParams = new URLSearchParams("status=CANCELLED");
    render(<CashBookClient {...defaultProps} initialStatus="CANCELLED" />);

    expect(screen.queryByRole("button", { name: /^Huỷ/i })).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("'Tất cả' shows a cancelled fixture row", () => {
    mockSearchParams = new URLSearchParams("status=ALL");
    render(<CashBookClient {...defaultProps} entries={sampleEntries.slice(0, 4)} initialStatus="ALL" />);

    expect(screen.getAllByText("CE-020").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đã huỷ").length).toBeGreaterThan(0);
  });

  it("computes totals from all entries even when status=CANCELLED hides them and when page shows only 20 rows", () => {
    mockSearchParams = new URLSearchParams("status=CANCELLED");
    render(<CashBookClient {...defaultProps} initialStatus="CANCELLED" />);

    // Total expense includes all ACTIVE rows in sampleEntries (1.500.000 + 21 * 100.000 = 3.600.000)
    const expenseEl = screen.getByTestId("total-expense");
    expect(expenseEl).toHaveTextContent("3.600.000đ");

    // Total income includes CE-040 (2.443.400) + CE-034 (6.683.290) = 9.126.690
    const incomeEl = screen.getByTestId("total-income");
    expect(incomeEl).toHaveTextContent("9.126.690đ");

    // Outside PnL is CE-040 (2.443.400)
    const outsideEl = screen.getByTestId("income-outside-pnl");
    expect(outsideEl).toHaveTextContent("2.443.400đ");

    // by-category exists
    expect(screen.getByTestId("by-category")).toBeInTheDocument();
  });

  it("orders by default with newest date first (CE-034 dated 2026-04-30 comes after CE-032 dated 2026-09-02)", () => {
    render(<CashBookClient {...defaultProps} entries={sampleEntries.slice(0, 4)} initialStatus="ALL" />);

    const allCodeNodes = screen.getAllByText(/^CE-(040|032|034)$/);
    const codes = allCodeNodes.map((n) => n.textContent);
    // Unique list in rendered order: CE-040 (2026-09-30) -> CE-032 (2026-09-02) -> CE-034 (2026-04-30)
    const ce032Idx = codes.indexOf("CE-032");
    const ce034Idx = codes.indexOf("CE-034");

    expect(ce032Idx).toBeGreaterThan(-1);
    expect(ce034Idx).toBeGreaterThan(-1);
    expect(ce034Idx).toBeGreaterThan(ce032Idx);
  });
});
