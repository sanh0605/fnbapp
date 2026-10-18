// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlMonthCards } from "./PnlMonthCards";

afterEach(() => cleanup());
const table = () => buildPnlTable(pnlFigures2026(), "2026-09-11", "năm nay");

describe("PnlMonthCards", () => {
  it("puts the range first, named as chosen, then the months newest first", () => {
    render(<PnlMonthCards table={table()} />);
    const section = screen.getByRole("region", { name: "Từng tháng" });
    const titles = Array.from(section.children)
      .filter(c => c.tagName === "DETAILS")
      .map(c => c.querySelector("summary")!.textContent);
    expect(titles).toHaveLength(4);
    expect(titles[0]).toContain("NĂM NAY");
    expect(titles[0]).toContain("Doanh thu");
    expect(titles[1]).toContain("09/2026");
    expect(titles[1]).toContain("đến 11/09");
    expect(titles[1]).not.toContain("09/2026 (đến 11/09)");
    expect(titles[2]).toContain("08/2026");
    expect(titles[3]).toContain("03/2026");
  });

  it("a month card shows its net profit on the outside, in red for a loss", () => {
    render(<PnlMonthCards table={table()} />);
    const august = screen.getByTestId("pnl-month-2026-08");
    const net = within(august.querySelector("summary")!).getByText("-32,372,964");
    expect(net.className).toContain("text-danger");
  });

  it("the year card is closed by default and its summary reads the year's revenue", () => {
    render(<PnlMonthCards table={table()} />);
    const year = screen.getByTestId("pnl-year");
    expect(year).not.toHaveAttribute("open");
    const summary = year.querySelector("summary")!;
    expect(summary.textContent).toContain("Doanh thu");
    expect(summary.textContent).toContain("22,736,000");
  });

  it("the August card's summary shows the revenue figure", () => {
    render(<PnlMonthCards table={table()} />);
    const august = screen.getByTestId("pnl-month-2026-08");
    expect(august.querySelector("summary")!.textContent).toContain("17,682,000");
  });

  it("the 08/2026 card title carries the note number", () => {
    render(<PnlMonthCards table={table()} />);
    const august = screen.getByTestId("pnl-month-2026-08");
    expect(august.querySelector("summary")?.textContent).toContain("(1)");
  });

  it("inside August, Vận hành opens its four cash-book rows, each shown with a minus", () => {
    render(<PnlMonthCards table={table()} />);
    const august = screen.getByTestId("pnl-month-2026-08");
    const line = within(august).getByTestId("pnl-line-expense:CFC-001");
    expect(line.tagName).toBe("DETAILS");
    const items = within(line).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toContain("Dán lại xe Phin Đi");
    expect(items[0].textContent).toContain("-300,000");
  });

  it("inside August, Giá vốn shows its minus without red", () => {
    render(<PnlMonthCards table={table()} />);
    const august = screen.getByTestId("pnl-month-2026-08");
    const line = within(august).getByTestId("pnl-line-cogs");
    expect(line.textContent).toContain("-46,418,990");
    const value = within(line).getByText("-46,418,990");
    expect(value.className).not.toContain("text-danger");
  });

  it("a line with nothing to open is a plain line, and the year card has nothing to open", () => {
    render(<PnlMonthCards table={table()} />);
    const march = screen.getByTestId("pnl-month-2026-03");
    expect(within(march).getByTestId("pnl-line-nonInventory").tagName).toBe("DIV");
    const year = screen.getByTestId("pnl-year");
    expect(year.querySelectorAll("details")).toHaveLength(0);
    expect(year.textContent).toContain("-31,724,837");
  });

  it("the notes render under the last card", () => {
    render(<PnlMonthCards table={table()} />);
    const notes = screen.getByRole("region", { name: "Ghi chú" });
    expect(notes.textContent).toContain("kiểm kho");
  });

  // BR-UI-007: a span of 24 months gives 24 cards on a phone.
  it("24 months give 24 month cards", () => {
    const figures = pnlFigures2026();
    const months = Array.from({ length: 24 }, (_, i) => {
      const y = 2024 + Math.floor((9 + i) / 12);
      const m = ((9 + i) % 12) + 1;
      return { ...figures.months[0], month: `${y}-${String(m).padStart(2, "0")}` };
    });
    render(<PnlMonthCards table={buildPnlTable({ ...figures, fromMonth: "2024-10", toMonth: "2026-09", months }, "2026-10-09", "trong khoảng đã chọn")} />);
    expect(screen.getAllByTestId(/^pnl-month-/)).toHaveLength(24);
    expect(screen.getByTestId("pnl-month-2024-10")).toBeInTheDocument();
    expect(screen.getByTestId("pnl-month-2026-09")).toBeInTheDocument();
  });

  it("has no text size classes below 12px (no text-[11px], uses text-xs)", () => {
    const { container } = render(<PnlMonthCards table={table()} />);
    expect(container.querySelectorAll(".text-\\[11px\\], .text-\\[10px\\], .text-\\[9px\\], .text-\\[10\\.5px\\], .text-\\[11\\.5px\\]")).toHaveLength(0);
  });

  it("omits the asterisk note when data has a partial month", () => {
    const t = table();
    expect(t.chart.some(p => p.partial)).toBe(true);
    render(<PnlMonthCards table={t} />);
    expect(screen.queryByText(/Tháng đang chạy/)).toBeNull();
  });
});
