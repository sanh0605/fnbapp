// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import MonthlyItemsClient from "./MonthlyItemsClient";
import type { MonthlyItemRow } from "../actions";
import type { DBCashCategory } from "@/types/db";

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
  usePathname: () => "/admin/finance/monthly-items",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const CATEGORIES: DBCashCategory[] = [
  { id: "CFC-001", name: "Chi phí cố định", kind: "EXPENSE", status: "ACTIVE", affects_pnl: true, is_sales_revenue: false },
  { id: "CFC-002", name: "Vận hành", kind: "EXPENSE", status: "ACTIVE", affects_pnl: true, is_sales_revenue: false },
] as DBCashCategory[];

const SAMPLE_ITEMS: MonthlyItemRow[] = [
  {
    item: {
      id: "KCT-001",
      name: "Tiền điện",
      cash_category_id: "CFC-001",
      status: "ACTIVE",
      created_at: "2026-10-14T09:00:00Z",
      created_by_id: "a-1",
      created_by_name: "Admin",
      updated_at: "2026-10-14T09:00:00Z",
      updated_by_id: "a-1",
      updated_by_name: "Admin",
    },
    entryCount: 5,
  },
  {
    item: {
      id: "KCT-002",
      name: "Tiền nước",
      cash_category_id: "CFC-002",
      status: "INACTIVE",
      created_at: "2026-10-14T09:00:00Z",
      created_by_id: "a-1",
      created_by_name: "Admin",
      updated_at: "2026-10-14T09:00:00Z",
      updated_by_id: "a-1",
      updated_by_name: "Admin",
    },
    entryCount: 0,
  },
];

describe("MonthlyItemsClient", () => {
  it("renders page header, reminder description line, and Tạo button", () => {
    render(<MonthlyItemsClient items={SAMPLE_ITEMS} categories={CATEGORIES} />);
    expect(screen.getByText("Khoản chi hằng tháng")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Mỗi khoản được nhắc ở Tổng quan từ ngày bắt đầu nhắc của mỗi tháng cho tới khi có một dòng chi gắn khoản đó trong tháng.",
      ),
    ).toBeInTheDocument();
    const createBtn = screen.getByRole("link", { name: "Tạo" });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn.getAttribute("href")).toContain("/admin/finance/monthly-items/new");
  });

  it("renders table columns with correct values, Mã column and links when status=ALL", () => {
    render(<MonthlyItemsClient items={SAMPLE_ITEMS} categories={CATEGORIES} initialStatus="ALL" />);
    expect(screen.getAllByText("KCT-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tiền điện").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chi phí cố định").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang dùng").length).toBeGreaterThan(0);

    expect(screen.getAllByText("KCT-002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tiền nước").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vận hành").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);

    const rowLinks = screen.getAllByRole("link").filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/finance/monthly-items/KCT-001"),
    );
    expect(rowLinks.length).toBeGreaterThan(0);
  });

  it("renders phone rows with title, '{n} dòng' value, category meta, and status badge", () => {
    const { container } = render(
      <MonthlyItemsClient items={SAMPLE_ITEMS} categories={CATEGORIES} initialStatus="ALL" />,
    );

    const phoneList = container.querySelector<HTMLElement>(".md\\:hidden.flex.flex-col")!;
    expect(within(phoneList).getByText("Tiền điện")).toBeInTheDocument();
    expect(within(phoneList).getByText("5 dòng")).toBeInTheDocument();
    expect(within(phoneList).getByText("Chi phí cố định")).toBeInTheDocument();
    expect(within(phoneList).getByText("Đang dùng")).toBeInTheDocument();
    expect(within(phoneList).getByText("Tiền nước")).toBeInTheDocument();
    expect(within(phoneList).getByText("0 dòng")).toBeInTheDocument();
    expect(within(phoneList).getByText("Vận hành")).toBeInTheDocument();
    expect(within(phoneList).getByText("Ngừng dùng")).toBeInTheDocument();
    expect(within(phoneList).queryByText("KCT-001")).toBeNull();
  });

  it("defaults to ACTIVE status filter, hiding inactive items", () => {
    render(<MonthlyItemsClient items={SAMPLE_ITEMS} categories={CATEGORIES} />);
    expect(screen.getAllByText("Tiền điện").length).toBeGreaterThan(0);
    expect(screen.queryByText("Tiền nước")).toBeNull();
  });

  it("status filter filters items", () => {
    mockSearchParams = new URLSearchParams("status=ACTIVE");
    render(
      <MonthlyItemsClient
        items={SAMPLE_ITEMS}
        categories={CATEGORIES}
        initialStatus="ACTIVE"
      />,
    );
    expect(screen.getAllByText("Tiền điện").length).toBeGreaterThan(0);
    expect(screen.queryByText("Tiền nước")).toBeNull();
  });

  it("clearing filters resets status to ACTIVE and clears search", () => {
    mockSearchParams = new URLSearchParams("status=INACTIVE&q=nước");
    render(
      <MonthlyItemsClient
        items={SAMPLE_ITEMS}
        categories={CATEGORIES}
        initialStatus="INACTIVE"
        initialSearch="nước"
      />,
    );
    const clearBtn = screen.getByRole("button", { name: "Xoá lọc" });
    fireEvent.click(clearBtn);
    expect(replace).toHaveBeenCalledWith("/admin/finance/monthly-items", { scroll: false });
  });

  it("shows empty state when no items match the filter", () => {
    render(
      <MonthlyItemsClient
        items={SAMPLE_ITEMS}
        categories={CATEGORIES}
        initialSearch="không tồn tại"
      />,
    );
    expect(screen.getByText("Không có khoản chi nào khớp bộ lọc")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Xoá lọc" })[0]).toBeInTheDocument();
  });

  it("shows empty state when there are no monthly items created yet", () => {
    render(<MonthlyItemsClient items={[]} categories={CATEGORIES} />);
    expect(screen.getByText("Chưa có khoản chi hằng tháng nào")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoá lọc" })).toBeNull();
  });
});
