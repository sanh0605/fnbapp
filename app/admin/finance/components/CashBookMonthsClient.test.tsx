// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import CashBookMonthsClient from "./CashBookMonthsClient";
import type { CashBookMonth } from "@/lib/finance/cash-book-months";
import FinancePage from "../page";

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

const { replace, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    push: pushFn,
    router: { replace: replaceFn, push: pushFn },
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

const getCashBookMonths = vi.hoisted(() => vi.fn());
const getFinancePageData = vi.hoisted(() => vi.fn());

vi.mock("@/app/admin/finance/actions", () => ({
  getCashBookMonths,
  getFinancePageData,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const septemberFixture: CashBookMonth = {
  month: "2026-09",
  cash: {
    opening: -10341000,
    salesIncome: 15442000,
    handIncome: [{ key: "CFC-005", name: "Vốn góp", total: 2443400 }],
    purchaseExpense: 9043287,
    handExpense: [{ key: "CFC-001", name: "Vận hành", total: 1637000 }],
    closing: -7351887,
  },
  bank: {
    opening: 23756578,
    salesIncome: 5000000,
    handIncome: [{ key: "CFC-006", name: "Doanh thu ghi tay", total: 443400 }],
    purchaseExpense: 2000000,
    handExpense: [{ key: "CFC-002", name: "Marketing", total: 137000 }],
    closing: 27972578,
  },
};

const augustFixture: CashBookMonth = {
  month: "2026-08",
  cash: {
    opening: -12000000,
    salesIncome: 8000000,
    handIncome: [{ key: "CFC-005", name: "Vốn góp", total: 1000000 }],
    purchaseExpense: 4000000,
    handExpense: [],
    closing: -10341000,
  },
  bank: {
    opening: 20000000,
    salesIncome: 3000000,
    handIncome: [],
    purchaseExpense: 1000000,
    handExpense: [],
    closing: 23756578,
  },
};

const septFixtureNoVonGop: CashBookMonth = {
  month: "2026-09",
  cash: {
    opening: -10341000,
    salesIncome: 15442000,
    handIncome: [],
    purchaseExpense: 9043287,
    handExpense: [{ key: "CFC-001", name: "Vận hành", total: 1637000 }],
    closing: -7351887,
  },
  bank: {
    opening: 23756578,
    salesIncome: 5000000,
    handIncome: [],
    purchaseExpense: 2000000,
    handExpense: [],
    closing: 27972578,
  },
};

describe("CashBookMonthsClient (G-TC2)", () => {
  it("September 2026 card/columns show the given numbers from a fixture", () => {
    render(
      <CashBookMonthsClient
        months={[septemberFixture]}
        range={{ preset: "CUSTOM", start: "2026-09", end: "2026-09" }}
        today="2026-10-15"
      />,
    );

    // Headline figures
    expect(screen.getByTestId("headline-closing-cash")).toHaveTextContent(
      "-7,351,887đ",
    );
    expect(screen.getByTestId("headline-closing-bank")).toHaveTextContent(
      "27,972,578đ",
    );

    // Month label
    expect(screen.getAllByText("09/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tháng 09/2026").length).toBeGreaterThan(0);

    // Computer columns / phone card numbers
    expect(screen.getAllByText("-10,341,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("15,442,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2,443,400đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("9,043,287đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,637,000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-7,351,887đ").length).toBeGreaterThan(0);

    expect(screen.getAllByText("23,756,578đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("27,972,578đ").length).toBeGreaterThan(0);

    // Phone card exists
    const phoneCard = screen.getByTestId("month-card-2026-09");
    expect(phoneCard).toBeInTheDocument();
    expect(within(phoneCard).getByText("-10,341,000đ")).toBeInTheDocument();
    expect(within(phoneCard).getByText("2,443,400đ")).toBeInTheDocument();
    expect(within(phoneCard).getByText("1,637,000đ")).toBeInTheDocument();
  });

  it("tab switch keeps the range", async () => {
    getCashBookMonths.mockResolvedValue([septemberFixture]);
    getFinancePageData.mockResolvedValue({
      rows: [],
      summary: {
        opening: { cash: 0, bank: 0, total: 0 },
        closing: { cash: 0, bank: 0, total: 0 },
        totals: {
          totalIncome: 0,
          totalExpense: 0,
          salesIncome: 0,
          purchaseExpense: 0,
          handIncome: 0,
          handExpense: 0,
          incomeOutsidePnl: 0,
        },
        byGroup: [],
        unknownCategoryIds: [],
      },
    });

    // 1. From months view with CUSTOM range
    const pageMonths = await FinancePage({
      searchParams: Promise.resolve({
        view: "months",
        range: "CUSTOM",
        from: "2026-06",
        to: "2026-09",
      }),
    });
    const { unmount } = render(pageMonths);

    const listTab = screen.getByRole("link", { name: "Sổ thu chi" });
    const monthsTab = screen.getByRole("link", { name: "Theo tháng" });

    expect(listTab.getAttribute("href")).toContain("range=CUSTOM");
    expect(listTab.getAttribute("href")).toContain("from=2026-06");
    expect(listTab.getAttribute("href")).toContain("to=2026-09");
    expect(listTab.getAttribute("href")).not.toContain("view=months");

    expect(monthsTab.getAttribute("href")).toContain("range=CUSTOM");
    expect(monthsTab.getAttribute("href")).toContain("from=2026-06");
    expect(monthsTab.getAttribute("href")).toContain("to=2026-09");
    expect(monthsTab.getAttribute("href")).toContain("view=months");

    unmount();

    // 2. From list view with THIS_MONTH range
    const pageList = await FinancePage({
      searchParams: Promise.resolve({
        range: "THIS_MONTH",
      }),
    });
    render(pageList);

    const listTab2 = screen.getByRole("link", { name: "Sổ thu chi" });
    const monthsTab2 = screen.getByRole("link", { name: "Theo tháng" });

    expect(listTab2.getAttribute("href")).toContain("range=THIS_MONTH");
    expect(listTab2.getAttribute("href")).not.toContain("view=months");

    expect(monthsTab2.getAttribute("href")).toContain("range=THIS_MONTH");
    expect(monthsTab2.getAttribute("href")).toContain("view=months");
  });

  it("a group present only in one month shows '–' in others", () => {
    render(
      <CashBookMonthsClient
        months={[augustFixture, septFixtureNoVonGop]}
        range={{ preset: "CUSTOM", start: "2026-08", end: "2026-09" }}
        today="2026-10-15"
      />,
    );

    // In August, "Vốn góp" is 1,000,000đ; in September, it is "–"
    expect(screen.getAllByText("1,000,000đ").length).toBeGreaterThan(0);
    // In August, "Vận hành" is "–"; in September, it is 1,637,000đ
    expect(screen.getAllByText("1,637,000đ").length).toBeGreaterThan(0);

    // "–" elements appear for missing groups across desktop table and phone cards
    const dashes = screen.getAllByText("–");
    expect(dashes.length).toBeGreaterThanOrEqual(2);

    // Verify specifically in August phone card
    const augCard = screen.getByTestId("month-card-2026-08");
    const vonGopAugRow = within(augCard).getByText("Vốn góp").closest("div");
    expect(vonGopAugRow).toHaveTextContent("1,000,000đ");
    const vanHanhAugRow = within(augCard).getByText("Vận hành").closest("div");
    expect(vanHanhAugRow).toHaveTextContent("–");

    // Verify specifically in September phone card
    const septCard = screen.getByTestId("month-card-2026-09");
    const vanHanhSeptRow = within(septCard).getByText("Vận hành").closest("div");
    expect(vanHanhSeptRow).toHaveTextContent("1,637,000đ");
    const vonGopSeptRow = within(septCard).getByText("Vốn góp").closest("div");
    expect(vonGopSeptRow).toHaveTextContent("–");
  });
});
