// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlTableView } from "./PnlTableView";

afterEach(() => cleanup());
const table = () => buildPnlTable(pnlFigures2026(), "2026-09-11");

describe("PnlTableView", () => {
  it("clicking Vận hành in 08/2026 lists its four cash-book rows under the table, each shown with a minus; clicking again closes them", () => {
    render(<PnlTableView table={table()} />);
    fireEvent.click(screen.getByRole("button", { name: "Vận hành 08/2026" }));
    const detail = screen.getByRole("region", { name: "Chi tiết: Vận hành 08/2026" });
    const items = within(detail).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toContain("Dán lại xe Phin Đi");
    expect(items[0].textContent).toContain("02/08/2026");
    expect(items[0].textContent).toContain("-300.000");
    items.forEach(item => expect(item.textContent).toMatch(/-/));
    fireEvent.click(screen.getByRole("button", { name: "Vận hành 08/2026" }));
    expect(screen.queryByRole("region", { name: "Chi tiết: Vận hành 08/2026" })).toBeNull();
  });

  it("a profit cell opens the sum behind it", () => {
    render(<PnlTableView table={table()} />);
    fireEvent.click(screen.getByRole("button", { name: "Lợi nhuận ròng 08/2026" }));
    const detail = screen.getByRole("region", { name: "Chi tiết: Lợi nhuận ròng 08/2026" });
    expect(detail.textContent).toContain("Lợi nhuận gộp -30.496.990 − chi phí 1.085.000 − khấu hao 790.974 = -32.372.964");
  });

  it("shows a loss in red, with a minus sign", () => {
    render(<PnlTableView table={table()} />);
    const cell = screen.getByRole("button", { name: "Lợi nhuận ròng 08/2026" });
    expect(cell.textContent).toBe("-32.372.964");
    expect(cell.closest("td")!.className).toContain("text-danger");
  });

  it("a cost row's cell shows its minus without red", () => {
    render(<PnlTableView table={table()} />);
    const cell = screen.getByRole("button", { name: "Giá vốn 08/2026" });
    expect(cell.textContent).toBe("-46.418.990");
    expect(cell.closest("td")!.className).not.toContain("text-danger");
  });

  it("the month still running says how far its figures reach", () => {
    render(<PnlTableView table={table()} />);
    expect(screen.getByRole("columnheader", { name: "09/2026 (đến 11/09)" })).toBeTruthy();
  });

  it("the 08/2026 header shows the note number the fixture gives it", () => {
    render(<PnlTableView table={table()} />);
    const header = screen.getByRole("columnheader", { name: "08/2026" });
    expect(header.querySelector("sup")?.textContent).toBe("1");
  });

  it("the Luỹ kế row exists", () => {
    render(<PnlTableView table={table()} />);
    expect(screen.getByText("Luỹ kế")).toBeTruthy();
  });

  it("the notes render inside the table section", () => {
    render(<PnlTableView table={table()} />);
    const notes = screen.getByRole("region", { name: "Ghi chú" });
    expect(notes.textContent).toContain("kiểm kho");
  });

  it("an empty cell and the Tổng column do not open anything; the panel's hint explains itself", () => {
    render(<PnlTableView table={table()} />);
    expect(screen.queryByRole("button", { name: "Nguyên liệu mua dùng ngay 03/2026" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Tổng/ })).toBeNull();
    expect(screen.getByText(/Bấm vào một ô để xem số đó từ đâu ra/)).toBeTruthy();
  });
});
