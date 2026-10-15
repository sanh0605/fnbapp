// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
  it("issued page shows Hàng dùng and Hao hụt per month and a total", async () => {
    const page = await IssuedValueReportPage({
      searchParams: Promise.resolve({ tab: "months", range: "THIS_YEAR" }),
    });

    render(page);

    // Month label
    expect(screen.getAllByText(/Tháng 09\/2026/).length).toBeGreaterThan(0);

    // Shows Hàng dùng and Hao hụt
    expect(screen.getAllByText("Hàng dùng").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hao hụt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("8,454,110đ").length).toBeGreaterThan(0);

    // Shows total row
    expect(screen.getAllByText("Tổng cộng").length).toBeGreaterThan(0);
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
