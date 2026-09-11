// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlSummary } from "./PnlSummary";

afterEach(() => cleanup());

describe("PnlSummary", () => {
  it("shows revenue and net profit so far this year, the margin, and the covered period", () => {
    render(<PnlSummary table={buildPnlTable(pnlFigures2026(), "2026-09-11")} />);
    const text = screen.getByRole("region", { name: "Tóm tắt" }).textContent;
    expect(text).toContain("Doanh thu từ đầu năm");
    expect(text).toContain("22.736.000");
    expect(text).toContain("từ 03/2026 đến 11/09/2026");
    expect(text).toContain("Lợi nhuận ròng từ đầu năm");
    expect(text).toContain("-31.724.837");
    expect(text).toContain("biên -139,54% doanh thu");
  });

  it("shows the best month's title as its value, and its net profit in the sub-line", () => {
    render(<PnlSummary table={buildPnlTable(pnlFigures2026(), "2026-09-11")} />);
    const text = screen.getByRole("region", { name: "Tóm tắt" }).textContent;
    expect(text).toContain("Tháng lời nhất");
    expect(text).toContain("09/2026");
    expect(text).toContain("697.353");
  });

  it("shows the worst month's title as its value, and its amount with a note reference in the sub-line", () => {
    render(<PnlSummary table={buildPnlTable(pnlFigures2026(), "2026-09-11")} />);
    const text = screen.getByRole("region", { name: "Tóm tắt" }).textContent;
    expect(text).toContain("Tháng lỗ nhất");
    expect(text).toContain("08/2026");
    expect(text).toContain("-32.372.964");
    expect(text).toContain("xem ghi chú");
  });

  it("leaves out the worst-month tile when no month lost money", () => {
    const figures = pnlFigures2026();
    const september = { ...figures, months: figures.months.filter(m => m.month === "2026-09") };
    render(<PnlSummary table={buildPnlTable(september, "2026-09-11")} />);
    expect(screen.queryByText("Tháng lỗ nhất")).toBeNull();
  });
});
