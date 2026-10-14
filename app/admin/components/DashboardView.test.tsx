// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "./DashboardView";
import { formatNumber } from "@/lib/shared/format";
import type { DashboardData } from "@/lib/dashboard/dashboard-data";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

afterEach(() => cleanup());

// Spec docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md, section 3 (real example):
// 08/10 and 13/10 real figures, food columns Trứng luộc / Khoai lang.
function row(day: string, revenue: number, avg: number, cups: number, egg: number, potato: number, topping: number | null = 0) {
  return { day, revenue, cups, cupMoney: avg * cups, avgPerCup: avg, foodQty: { "PROD-028": egg, "PROD-027": potato }, toppingQty: topping };
}

const QUIET: DashboardData = {
  posSyncFailureCount: 0,
  negativeStock: [],
  stocktake: { stale: null, openTooLong: [] },
  reminders: [],
  table: [
    row("2026-10-08", 714000, 20889, 27, 22, 12),
    row("2026-10-09", 838000, 21344, 32, 25, 14),
    row("2026-10-10", 480000, 20000, 19, 19, 9),
    row("2026-10-11", 30000, 15000, 2, 0, 0),
    row("2026-10-12", 873000, 20848, 33, 25, 18),
    row("2026-10-13", 526000, 21235, 17, 22, 11),
    row("2026-10-14", 0, 0, 0, 0, 0),
  ],
  foodColumns: [{ id: "PROD-028", name: "Trứng luộc" }, { id: "PROD-027", name: "Khoai lang" }],
  toppingColumnName: "Topping",
};

const BUSY: DashboardData = {
  ...QUIET,
  posSyncFailureCount: 2,
  negativeStock: [{ id: "NL-001", name: "Sữa đặc", qty: -2 }],
  stocktake: {
    stale: { lastConfirmedDay: "2026-08-09", daysSince: 66 },
    openTooLong: [{ id: "STK-002", openedDay: "2026-10-11", daysOpen: 3 }],
  },
  reminders: [{ itemId: "KCT-001", itemName: "Tiền điện", month: "2026-10", cashCategoryId: "CFC-002" }],
};

describe("DashboardView alerts (owner 2026-10-14: alerts first)", () => {
  it("says there is nothing to look at when every alert is quiet", () => {
    render(<DashboardView data={QUIET} />);
    expect(screen.getByText("Không có gì cần xử lý")).toBeInTheDocument();
  });

  it("links the POS failure alert to /admin/pos-sync with the count", () => {
    render(<DashboardView data={BUSY} />);
    const link = screen.getByText(/2 đơn máy bán hàng gửi lại không được/).closest("a")!;
    expect(link.getAttribute("href")).toBe("/admin/pos-sync");
  });

  it("names each negative item by its real name and links to the item list", () => {
    render(<DashboardView data={BUSY} />);
    const alert = screen.getByText(/Hàng trên sổ bị âm/).closest("a")!;
    expect(alert.getAttribute("href")).toBe("/admin/inventory/items");
    expect(within(alert).getByText(/Sữa đặc/)).toBeInTheDocument();
    expect(within(alert).getByText(/-2/)).toBeInTheDocument();
  });

  it("says how long since the last stock count, as a Vietnamese day", () => {
    render(<DashboardView data={BUSY} />);
    const alert = screen.getByText(/66 ngày chưa kiểm kê/).closest("a")!;
    expect(alert.getAttribute("href")).toBe("/admin/inventory/stocktake");
    expect(within(alert).getByText(/09\/08\/2026/)).toBeInTheDocument();
  });

  it("says when there has never been a stock count", () => {
    render(<DashboardView data={{ ...QUIET, stocktake: { stale: { lastConfirmedDay: null, daysSince: null }, openTooLong: [] } }} />);
    expect(screen.getByText(/Chưa kiểm kê lần nào/)).toBeInTheDocument();
  });

  it("names an open stock count left more than the set days", () => {
    render(<DashboardView data={BUSY} />);
    expect(screen.getByText(/Phiếu kiểm kê mở từ 11\/10\/2026, đã 3 ngày chưa xác nhận/)).toBeInTheDocument();
  });

  it("reminds of a missing monthly expense by name and month, with Nhập opening the cash form prefilled", () => {
    render(<DashboardView data={BUSY} />);
    expect(screen.getByText("Chưa nhập Tiền điện tháng 10/2026")).toBeInTheDocument();
    const enter = screen.getByRole("link", { name: "Nhập" });
    expect(enter.getAttribute("href")).toBe("/admin/finance/new?monthlyItem=KCT-001&returnTo=%2Fadmin");
  });

  it("puts alerts above the 7-day table", () => {
    const { container } = render(<DashboardView data={BUSY} />);
    const alertsBox = screen.getByText(/66 ngày chưa kiểm kê/);
    const table = container.querySelector("table")!;
    expect(alertsBox.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("DashboardView 7-day table on a computer", () => {
  it("has the columns in order, one per chosen food, topping last", () => {
    const { container } = render(<DashboardView data={QUIET} />);
    const headers = [...container.querySelectorAll("table thead th")].map(th => th.textContent?.trim());
    expect(headers).toEqual(["Ngày", "Doanh thu", "TB mỗi ly", "Số ly", "Trứng luộc", "Khoai lang", "Topping mua riêng"]);
  });

  it("drops the topping column when no topping type is set", () => {
    const data = { ...QUIET, toppingColumnName: null, table: QUIET.table.map(r => ({ ...r, toppingQty: null })) };
    const { container } = render(<DashboardView data={data} />);
    const headers = [...container.querySelectorAll("table thead th")].map(th => th.textContent?.trim());
    expect(headers).not.toContain("Topping mua riêng");
  });

  it("shows 08/10 with the real figures in formatNumber, newest day first", () => {
    const { container } = render(<DashboardView data={QUIET} />);
    const bodyRows = [...container.querySelectorAll("table tbody tr")];
    expect(bodyRows).toHaveLength(7);
    expect(bodyRows[0].textContent).toContain("14/10");
    const oct8 = bodyRows[6];
    const cells = [...oct8.querySelectorAll("td")].map(td => td.textContent?.trim());
    expect(cells[0]).toContain("08/10");
    expect(cells.slice(1)).toEqual([formatNumber(714000), formatNumber(20889), "27", "22", "12", "0"]);
  });

  it("keeps the table in a box shown from md up and the cards in a box hidden from md up", () => {
    const { container } = render(<DashboardView data={QUIET} />);
    const desktopBox = container.querySelector("table")!.closest(".md\\:block")!;
    expect(desktopBox).not.toBeNull();
    expect(desktopBox.className).toContain("hidden");
    expect(container.querySelector(".md\\:hidden")).not.toBeNull();
  });
});

describe("DashboardView 7-day cards on a phone", () => {
  it("has one card per day, newest first, each naming the food columns", () => {
    const { container } = render(<DashboardView data={QUIET} />);
    const phone = container.querySelector(".md\\:hidden")!;
    const cards = phone.querySelectorAll("[data-day]");
    expect(cards).toHaveLength(7);
    expect(cards[0].getAttribute("data-day")).toBe("2026-10-14");
    const oct8 = phone.querySelector('[data-day="2026-10-08"]')!;
    expect(oct8.textContent).toContain(formatNumber(714000));
    expect(oct8.textContent).toContain("Trứng luộc");
    expect(oct8.textContent).toContain("Khoai lang");
  });
});

describe("DashboardView drops the old parts (owner 2026-10-14, BR-UI-007)", () => {
  it("has no figure boxes, best sellers or comparison", () => {
    render(<DashboardView data={QUIET} />);
    expect(screen.queryByText(/bán chạy/i)).toBeNull();
    expect(screen.queryByText(/so với/i)).toBeNull();
  });
});
