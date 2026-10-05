// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import CashBookClient from "./CashBookClient";
import type { DBBankAccount, DBCashCategory } from "@/types/db";
import type { CashBookRow } from "@/lib/finance/cash-book-rows";
import type { CashBookSummary } from "@/lib/finance/cash-flow";

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

vi.mock("@/app/admin/finance/transfers/actions", () => ({
  cancelCashTransfer: vi.fn(),
  deleteCashTransfer: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  mockSearchParams = new URLSearchParams();
  vi.useRealTimers();
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

// September 2026 worked example summary (spec section 10)
const septemberSummary: CashBookSummary = {
  opening: {
    cash: -10341000,
    bank: 23756578,
    total: 13415578,
  },
  closing: {
    cash: -7351887,
    bank: 27972578,
    total: 20620691,
  },
  totals: {
    totalIncome: 17885400,
    totalExpense: 10680287,
    salesIncome: 15442000,
    purchaseExpense: 9043287,
    handIncome: 2443400,
    handExpense: 1637000,
    incomeOutsidePnl: 2443400,
  },
  byGroup: [
    { key: "SALE", name: "Bán hàng", side: "INCOME", total: 15442000 },
    { key: "PURCHASE", name: "Nhập hàng", side: "EXPENSE", total: 9043287 },
    { key: "CFC-005", name: "Vốn góp", side: "INCOME", total: 2443400 },
    { key: "CFC-001", name: "Vận hành", side: "EXPENSE", total: 1637000 },
  ],
  unknownCategoryIds: [],
};

// Fixture rows including 15/09/2026 day rows, hand rows, transfers, and cancelled row
const sept15SaleCash: CashBookRow = {
  key: "SALE:2026-09-15:CASH",
  kind: "SALE",
  id: null,
  date: "2026-09-15",
  groupLabel: "Bán hàng",
  sideLabel: "Thu",
  amount: 522000,
  methodLabel: "Tiền mặt",
  accountLabel: "—",
  note: "23 đơn",
  creator: "—",
  status: "ACTIVE",
  href: "/admin/orders?from=2026-09-15&to=2026-09-15&payment=Tien%20mat",
};

const sept15SaleTransfer: CashBookRow = {
  key: "SALE:2026-09-15:BANK_TRANSFER",
  kind: "SALE",
  id: null,
  date: "2026-09-15",
  groupLabel: "Bán hàng",
  sideLabel: "Thu",
  amount: 482000,
  methodLabel: "Chuyển khoản",
  accountLabel: "—",
  note: "11 đơn",
  creator: "—",
  status: "ACTIVE",
  href: "/admin/orders?from=2026-09-15&to=2026-09-15&payment=Chuyen%20khoan",
};

const sept15PurchaseCash: CashBookRow = {
  key: "PURCHASE:2026-09-15:CASH:-",
  kind: "PURCHASE",
  id: null,
  date: "2026-09-15",
  groupLabel: "Nhập hàng",
  sideLabel: "Chi",
  amount: 536023,
  methodLabel: "Tiền mặt",
  accountLabel: "—",
  note: "2 đơn nhập",
  creator: "—",
  status: "ACTIVE",
  href: "/admin/inventory/purchase-orders?from=2026-09-15&to=2026-09-15&pay=CASH",
};

const ce040Hand: CashBookRow = {
  key: "CE-040",
  kind: "HAND",
  id: "CE-040",
  date: "2026-09-30",
  groupLabel: "Vốn góp",
  sideLabel: "Thu",
  amount: 2443400,
  methodLabel: "Tiền mặt",
  accountLabel: "—",
  note: "Vốn góp đợt mới",
  creator: "admin",
  status: "ACTIVE",
  href: "/admin/finance/CE-040",
};

const ce032Hand: CashBookRow = {
  key: "CE-032",
  kind: "HAND",
  id: "CE-032",
  date: "2026-09-02",
  groupLabel: "Vận hành",
  sideLabel: "Chi",
  amount: 1500000,
  methodLabel: "Tiền mặt",
  accountLabel: "—",
  note: "Tiền điện",
  creator: "admin",
  status: "ACTIVE",
  href: "/admin/finance/CE-032",
};

const ce034Hand: CashBookRow = {
  key: "CE-034",
  kind: "HAND",
  id: "CE-034",
  date: "2026-04-30",
  groupLabel: "Doanh thu ghi tay",
  sideLabel: "Thu",
  amount: 6683290,
  methodLabel: "Chuyển khoản",
  accountLabel: "ACB - Phin Di",
  note: "Doanh thu bị mất dữ liệu",
  creator: "admin",
  status: "ACTIVE",
  href: "/admin/finance/CE-034",
};

const ce020Cancelled: CashBookRow = {
  key: "CE-020",
  kind: "HAND",
  id: "CE-020",
  date: "2026-08-01",
  groupLabel: "Vận hành",
  sideLabel: "Chi",
  amount: 500000,
  methodLabel: "Tiền mặt",
  accountLabel: "—",
  note: "Khoản đã huỷ",
  creator: "admin",
  status: "CANCELLED",
  href: "/admin/finance/CE-020",
};

const ct001Transfer: CashBookRow = {
  key: "CT-001",
  kind: "TRANSFER",
  id: "CT-001",
  date: "2026-09-10",
  groupLabel: "Chuyển tiền",
  sideLabel: "Chuyển",
  amount: 5000000,
  methodLabel: "Két → ACB - Phin Di",
  accountLabel: "—",
  note: "Nộp tiền mặt vào tài khoản",
  creator: "admin",
  status: "ACTIVE",
  href: "/admin/finance/transfers/CT-001",
};

const sampleRows: CashBookRow[] = [
  ce040Hand,
  sept15SaleCash,
  sept15SaleTransfer,
  sept15PurchaseCash,
  ct001Transfer,
  ce032Hand,
  ce020Cancelled,
  ce034Hand,
  ...Array.from({ length: 21 }, (_, i) => {
    const num = i + 50;
    const id = `CE-${num.toString().padStart(3, "0")}`;
    return {
      key: id,
      kind: "HAND" as const,
      id,
      date: `2026-08-${(10 + (i % 15)).toString().padStart(2, "0")}`,
      groupLabel: "Vận hành",
      sideLabel: "Chi" as const,
      amount: 100000,
      methodLabel: "Tiền mặt",
      accountLabel: "—",
      note: `Chi phí ${num}`,
      creator: "admin",
      status: "ACTIVE" as const,
      href: `/admin/finance/${id}`,
    };
  }),
];

const defaultProps = {
  rows: sampleRows,
  summary: septemberSummary,
  categories: sampleCategories,
  accounts: sampleAccounts,
  canDelete: true,
  today: "2026-10-04",
  resolvedRange: {
    preset: "THIS_MONTH" as const,
    start: "2026-09-01",
    end: "2026-09-30",
  },
};

describe("CashBookClient", () => {
  it(
    "renders no 'Sửa' or '/edit' link",
    () => {
      render(<CashBookClient {...defaultProps} />);

      expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
      const allLinks = screen.getAllByRole("link");
      expect(
        allLinks.some((l) => l.getAttribute("href")?.includes("/edit")),
      ).toBe(false);
    },
    20000,
  );

  it("renders row links for HAND and TRANSFER with returnTo appended", () => {
    render(<CashBookClient {...defaultProps} />);

    const allLinks = screen.getAllByRole("link");
    const ce40Links = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/finance/CE-040?returnTo="),
    );
    expect(ce40Links.length).toBeGreaterThan(0);

    const ct001Links = allLinks.filter((l) =>
      l
        .getAttribute("href")
        ?.startsWith("/admin/finance/transfers/CT-001?returnTo="),
    );
    expect(ct001Links.length).toBeGreaterThan(0);
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
    render(
      <CashBookClient
        {...defaultProps}
        rows={[ce040Hand, ce020Cancelled]}
        initialStatus="ALL"
      />,
    );

    expect(screen.getAllByText("CE-020").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đã huỷ").length).toBeGreaterThan(0);
  });

  it("the 15/09/2026 day rows render with their labels and hrefs", () => {
    render(
      <CashBookClient
        {...defaultProps}
        rows={[sept15SaleCash, sept15SaleTransfer, sept15PurchaseCash]}
      />,
    );

    // Sale Cash: 23 đơn, 522.000đ, Tiền mặt
    expect(screen.getAllByText("23 đơn").length).toBeGreaterThan(0);
    expect(screen.getAllByText("522.000đ").length).toBeGreaterThan(0);
    const saleCashLink = screen
      .getAllByRole("link")
      .find((l) =>
        l
          .getAttribute("href")
          ?.includes(
            "/admin/orders?from=2026-09-15&to=2026-09-15&payment=Tien%20mat",
          ),
      );
    expect(saleCashLink).toBeDefined();

    // Sale Transfer: 11 đơn, 482.000đ, Chuyển khoản
    expect(screen.getAllByText("11 đơn").length).toBeGreaterThan(0);
    expect(screen.getAllByText("482.000đ").length).toBeGreaterThan(0);
    const saleTransferLink = screen
      .getAllByRole("link")
      .find((l) =>
        l
          .getAttribute("href")
          ?.includes(
            "/admin/orders?from=2026-09-15&to=2026-09-15&payment=Chuyen%20khoan",
          ),
      );
    expect(saleTransferLink).toBeDefined();

    // Purchase Cash: 2 đơn nhập, 536.023đ, Tiền mặt
    expect(screen.getAllByText("2 đơn nhập").length).toBeGreaterThan(0);
    expect(screen.getAllByText("536.023đ").length).toBeGreaterThan(0);
    const purchaseCashLink = screen
      .getAllByRole("link")
      .find((l) =>
        l
          .getAttribute("href")
          ?.includes(
            "/admin/inventory/purchase-orders?from=2026-09-15&to=2026-09-15&pay=CASH",
          ),
      );
    expect(purchaseCashLink).toBeDefined();
  });

  it("day rows have no checkbox and no status badge", () => {
    render(
      <CashBookClient
        {...defaultProps}
        rows={[sept15SaleCash, sept15SaleTransfer, sept15PurchaseCash]}
      />,
    );

    // Day rows have canRemove = false, so no checkboxes rendered
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Huỷ/i })).toBeNull();
  });

  it("rendered with canDelete={false} (a MANAGER), a HAND row and a TRANSFER row still have their selection checkbox, and day rows (SALE/PURCHASE) have none", () => {
    render(
      <CashBookClient
        {...defaultProps}
        canDelete={false}
        rows={[
          ce040Hand,
          ct001Transfer,
          sept15SaleCash,
          sept15PurchaseCash,
        ]}
      />,
    );

    // HAND row and TRANSFER row have their selection checkboxes
    expect(
      screen.getByRole("checkbox", { name: /Vốn góp/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Chuyển tiền/ }),
    ).toBeInTheDocument();

    // Day rows (SALE/PURCHASE) have none
    expect(
      screen.queryByRole("checkbox", { name: /Bán hàng/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("checkbox", { name: /Nhập hàng/ }),
    ).toBeNull();

    // 1 header select-all + 1 HAND + 1 TRANSFER
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("kind=SALE shows only sale rows", () => {
    mockSearchParams = new URLSearchParams("kind=SALE");
    render(
      <CashBookClient
        {...defaultProps}
        rows={[
          sept15SaleCash,
          sept15SaleTransfer,
          sept15PurchaseCash,
          ce040Hand,
          ct001Transfer,
        ]}
        initialKind="SALE"
      />,
    );

    expect(screen.getAllByText("23 đơn").length).toBeGreaterThan(0);
    expect(screen.getAllByText("11 đơn").length).toBeGreaterThan(0);
    expect(screen.queryByText("2 đơn nhập")).toBeNull();
    expect(screen.queryByText("CE-040")).toBeNull();
    expect(screen.queryByText("CT-001")).toBeNull();
  });

  it("status CANCELLED shows no day row and the balance cards keep their numbers", () => {
    mockSearchParams = new URLSearchParams("status=CANCELLED");
    render(
      <CashBookClient
        {...defaultProps}
        rows={[
          sept15SaleCash,
          sept15SaleTransfer,
          sept15PurchaseCash,
          ce020Cancelled,
        ]}
        initialStatus="CANCELLED"
      />,
    );

    // Day rows are ACTIVE, so none should appear under CANCELLED
    expect(screen.queryByText("23 đơn")).toBeNull();
    expect(screen.queryByText("11 đơn")).toBeNull();
    expect(screen.queryByText("2 đơn nhập")).toBeNull();
    expect(screen.getAllByText("CE-020").length).toBeGreaterThan(0);

    // Balance cards still show their figures from summary
    expect(screen.getByTestId("opening-cash")).toHaveTextContent(
      "-10.341.000đ",
    );
    expect(screen.getByTestId("closing-cash")).toHaveTextContent(
      "-7.351.887đ",
    );
  });

  it("balance cards show the September figures with negative numbers in text-danger", () => {
    render(<CashBookClient {...defaultProps} />);

    // Titles
    expect(screen.getByText("Đầu kỳ (01/09/2026)")).toBeInTheDocument();
    expect(screen.getByText("Cuối kỳ (30/09/2026)")).toBeInTheDocument();

    // Opening
    const opCash = screen.getByTestId("opening-cash");
    const opBank = screen.getByTestId("opening-bank");
    const opTotal = screen.getByTestId("opening-total");
    expect(opCash).toHaveTextContent("-10.341.000đ");
    expect(opCash).toHaveClass("text-danger");
    expect(opBank).toHaveTextContent("23.756.578đ");
    expect(opBank).not.toHaveClass("text-danger");
    expect(opTotal).toHaveTextContent("13.415.578đ");
    expect(opTotal).not.toHaveClass("text-danger");

    // Closing
    const clCash = screen.getByTestId("closing-cash");
    const clBank = screen.getByTestId("closing-bank");
    const clTotal = screen.getByTestId("closing-total");
    expect(clCash).toHaveTextContent("-7.351.887đ");
    expect(clCash).toHaveClass("text-danger");
    expect(clBank).toHaveTextContent("27.972.578đ");
    expect(clBank).not.toHaveClass("text-danger");
    expect(clTotal).toHaveTextContent("20.620.691đ");
    expect(clTotal).not.toHaveClass("text-danger");

    // Totals
    expect(screen.getByTestId("total-expense")).toHaveTextContent(
      "10.680.287đ",
    );
    expect(screen.getByTestId("total-income")).toHaveTextContent("17.885.400đ");
    expect(screen.getByTestId("income-outside-pnl")).toHaveTextContent(
      "2.443.400đ",
    );
  });

  it("orders by default with newest date first (CE-040 before CE-032)", () => {
    render(
      <CashBookClient
        {...defaultProps}
        rows={[ce032Hand, ce040Hand]}
        initialStatus="ALL"
      />,
    );

    const allCodeNodes = screen.getAllByText(/^CE-(040|032)$/);
    const codes = allCodeNodes.map((n) => n.textContent);
    const ce040Idx = codes.indexOf("CE-040");
    const ce032Idx = codes.indexOf("CE-032");

    expect(ce040Idx).toBeGreaterThan(-1);
    expect(ce032Idx).toBeGreaterThan(-1);
    expect(ce032Idx).toBeGreaterThan(ce040Idx);
  });
});
