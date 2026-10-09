// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlSummary } from "./PnlSummary";

afterEach(() => cleanup());

describe("PnlSummary", () => {
  // BR-UI-007: the tiles name the chosen range ("năm nay", "quý trước"...).
  it("shows revenue and net profit for the range, the margin, and the covered period", () => {
    render(<PnlSummary table={buildPnlTable(pnlFigures2026(), "2026-09-11", "năm nay")} />);
    const text = screen.getByRole("region", { name: "Tóm tắt" }).textContent;
    expect(text).toContain("Doanh thu năm nay");
    expect(text).toContain("22,736,000");
    expect(text).toContain("từ 03/2026 đến 11/09/2026");
    expect(text).toContain("Lợi nhuận ròng năm nay");
    expect(text).toContain("-31,724,837");
    expect(text).toContain("biên -139.54% doanh thu");
  });

  it("shows the best month's title as its value, and its net profit in the sub-line", () => {
    render(<PnlSummary table={buildPnlTable(pnlFigures2026(), "2026-09-11", "năm nay")} />);
    const text = screen.getByRole("region", { name: "Tóm tắt" }).textContent;
    expect(text).toContain("Tháng lời nhất");
    expect(text).toContain("09/2026");
    expect(text).toContain("697,353");
  });

  it("shows the worst month's title as its value, and its amount with a note reference in the sub-line", () => {
    render(<PnlSummary table={buildPnlTable(pnlFigures2026(), "2026-09-11", "năm nay")} />);
    const text = screen.getByRole("region", { name: "Tóm tắt" }).textContent;
    expect(text).toContain("Tháng lỗ nhất");
    expect(text).toContain("08/2026");
    expect(text).toContain("-32,372,964");
    expect(text).toContain("xem ghi chú");
  });

  it("leaves out the worst-month tile when no month lost money", () => {
    const figures = pnlFigures2026();
    const september = { ...figures, months: figures.months.filter(m => m.month === "2026-09") };
    render(<PnlSummary table={buildPnlTable(september, "2026-09-11", "năm nay")} />);
    expect(screen.queryByText("Tháng lỗ nhất")).toBeNull();
  });

  it("a span across the new year ends on the running month's own year", () => {
    const figures = pnlFigures2026();
    const t = buildPnlTable({ ...figures, fromMonth: "2025-11", toMonth: "2026-09" }, "2026-09-11", "trong khoảng đã chọn");
    render(<PnlSummary table={t} />);
    const region = screen.getByRole("region", { name: "Tóm tắt" }).textContent;
    expect(region).toContain("Doanh thu trong khoảng đã chọn");
    expect(region).toContain("đến 11/09/2026");
  });
});
