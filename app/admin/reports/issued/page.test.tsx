// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import React from "react";

const getIssuedValueReport = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ getIssuedValueReport }));
vi.mock("@/components/ui/DateRangeUrlButton", () => ({
  DateRangeUrlButton: () => <button data-testid="date-range-url-button">Tháng</button>,
}));

import IssuedValueReportPage from "./page";

const MOCK_REPORT = {
  grandTotal: 8_454_110,
  usedTotal: 8_454_110,
  shrinkageTotal: 0,
  items: [
    {
      purchasedItemId: "ITEM-1",
      name: "Sữa đặc",
      unitName: "hộp",
      issuedQuantity: 10,
      issuedValue: 500_000,
      closingValue: 200_000,
    },
  ],
  events: [
    {
      key: "EV-1",
      kind: "STOCKTAKE" as const,
      label: "Kiểm kê tháng 9",
      at: "2026-09-30T10:00:00Z",
      itemCount: 1,
      value: 500_000,
    },
  ],
  months: [
    {
      yearMonth: "2026-09",
      usedValue: 8_454_110,
      shrinkageValue: 0,
    },
  ],
};

beforeEach(() => {
  cleanup();
  getIssuedValueReport.mockReset();
  getIssuedValueReport.mockResolvedValue(MOCK_REPORT);
});

describe("IssuedValueReportPage (Ticket G-BC, spec root 2, R3)", () => {
  it("issued page shows Hàng dùng and Hao hụt per month and a total in a compact table", async () => {
    const page = await IssuedValueReportPage({
      searchParams: Promise.resolve({ tab: "months", range: "THIS_YEAR" }),
    });

    render(page);

    // Old phone cards are gone, table is visible on phone
    expect(document.querySelector(".md\\:hidden")).toBeNull();
    expect(document.querySelector(".hidden.md\\:block")).toBeNull();

    // Month label
    expect(screen.getAllByText(/Tháng 09\/2026/).length).toBeGreaterThan(0);

    // Column header sticks left
    const thangHeader = screen.getByRole("columnheader", { name: "Tháng" });
    expect(thangHeader.className).toContain("sticky");
    expect(thangHeader.className).toContain("left-0");

    // First cell of body row is TableRowHeader with stick="left"
    const rowHeader = screen.getByRole("rowheader", { name: /Tháng 09\/2026/ });
    expect(rowHeader.className).toContain("sticky");
    expect(rowHeader.className).toContain("left-0");

    // Shows Hàng dùng and Hao hụt
    expect(screen.getAllByText("Hàng dùng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hao hụt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("8,454,110đ").length).toBeGreaterThan(0);

    // Shows total row
    expect(screen.getAllByText("Tổng cộng").length).toBeGreaterThan(0);
  });

  it("items tab renders compact table on phone with sticky TableRowHeader", async () => {
    const page = await IssuedValueReportPage({
      searchParams: Promise.resolve({ tab: "items" }),
    });

    render(page);

    // No md:hidden card version or hidden md:block table
    expect(document.querySelector(".md\\:hidden")).toBeNull();
    expect(document.querySelector(".hidden.md\\:block")).toBeNull();

    // Table exists
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    // Column header sticks left
    const colHeader = screen.getByRole("columnheader", { name: "Nguyên liệu" });
    expect(colHeader.className).toContain("sticky");
    expect(colHeader.className).toContain("left-0");

    // First cell of body row is TableRowHeader with stick="left"
    const rowHeader = screen.getByRole("rowheader", { name: "Sữa đặc" });
    expect(rowHeader.className).toContain("sticky");
    expect(rowHeader.className).toContain("left-0");

    // Row has quantity and values
    const row = rowHeader.closest("tr")!;
    expect(within(row).getByText("10.00 hộp")).toBeInTheDocument();
    expect(within(row).getByText("500,000đ")).toBeInTheDocument();
    expect(within(row).getByText("200,000đ")).toBeInTheDocument();
  });


  it("tab links keep from/to", async () => {
    const page = await IssuedValueReportPage({
      searchParams: Promise.resolve({
        range: "CUSTOM",
        from: "2026-06",
        to: "2026-09",
        tab: "items",
      }),
    });

    render(page);

    // Find tab link buttons
    const itemsTab = screen.getByRole("link", { name: "Theo nguyên liệu" });
    const eventsTab = screen.getByRole("link", { name: "Theo lần xuất" });
    const monthsTab = screen.getByRole("link", { name: "Theo tháng" });

    // Verify href keeps from and to
    expect(itemsTab.getAttribute("href")).toContain("from=2026-06");
    expect(itemsTab.getAttribute("href")).toContain("to=2026-09");
    expect(itemsTab.getAttribute("href")).toContain("range=CUSTOM");
    expect(itemsTab.getAttribute("href")).toContain("tab=items");

    expect(eventsTab.getAttribute("href")).toContain("from=2026-06");
    expect(eventsTab.getAttribute("href")).toContain("to=2026-09");
    expect(eventsTab.getAttribute("href")).toContain("range=CUSTOM");
    expect(eventsTab.getAttribute("href")).toContain("tab=events");

    expect(monthsTab.getAttribute("href")).toContain("from=2026-06");
    expect(monthsTab.getAttribute("href")).toContain("to=2026-09");
    expect(monthsTab.getAttribute("href")).toContain("range=CUSTOM");
    expect(monthsTab.getAttribute("href")).toContain("tab=months");
  });
});
