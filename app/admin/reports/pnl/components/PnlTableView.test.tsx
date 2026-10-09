// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlTableView } from "./PnlTableView";

afterEach(() => cleanup());
const table = () => buildPnlTable(pnlFigures2026(), "2026-09-11", "năm nay");

describe("PnlTableView", () => {
  it("clicking Vận hành in 08/2026 lists its four cash-book rows under the table, each shown with a minus; clicking again closes them", () => {
    render(<PnlTableView table={table()} />);
    fireEvent.click(screen.getByRole("button", { name: "Vận hành 08/2026" }));
    const detail = screen.getByRole("region", { name: "Chi tiết: Vận hành 08/2026" });
    const items = within(detail).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toContain("Dán lại xe Phin Đi");
    expect(items[0].textContent).toContain("02/08/2026");
    expect(items[0].textContent).toContain("-300,000");
    items.forEach(item => expect(item.textContent).toMatch(/-/));
    fireEvent.click(screen.getByRole("button", { name: "Vận hành 08/2026" }));
    expect(screen.queryByRole("region", { name: "Chi tiết: Vận hành 08/2026" })).toBeNull();
  });

  it("a profit cell opens the sum behind it", () => {
    render(<PnlTableView table={table()} />);
    fireEvent.click(screen.getByRole("button", { name: "Lợi nhuận ròng 08/2026" }));
    const detail = screen.getByRole("region", { name: "Chi tiết: Lợi nhuận ròng 08/2026" });
    expect(detail.textContent).toContain("Lợi nhuận gộp -30,496,990 − chi phí 1,085,000 − khấu hao 790,974 = -32,372,964");
  });

  it("shows a loss in red, with a minus sign", () => {
    render(<PnlTableView table={table()} />);
    const cell = screen.getByRole("button", { name: "Lợi nhuận ròng 08/2026" });
    expect(cell.textContent).toBe("-32,372,964");
    expect(cell.closest("td")!.className).toContain("text-danger");
  });

  it("a cost row's cell shows its minus without red", () => {
    render(<PnlTableView table={table()} />);
    const cell = screen.getByRole("button", { name: "Giá vốn 08/2026" });
    expect(cell.textContent).toBe("-46,418,990");
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

  it("every sticky cell has a z-index, so scrolled columns (and their note superscripts) pass underneath it", () => {
    const { container } = render(<PnlTableView table={table()} />);
    const stickyCells = container.querySelectorAll(".sticky");
    expect(stickyCells.length).toBeGreaterThan(0);
    stickyCells.forEach(cell => {
      expect(cell.className).toMatch(/\bz-10\b/);
    });
  });
});

// Wave K5 (plan Review Focus 1): the table moves onto the shared Table set and
// keeps the look the owner approved 2026-09-11 -- Khoản, Tổng and % doanh thu
// stay put while the months scroll; profit rows are shaded and bold.
describe("PnlTableView -- the approved look on the Table set (wave K5)", () => {
  it("Khoản sticks left, Tổng and % doanh thu stick right", () => {
    render(<PnlTableView table={table()} />);
    const khoan = screen.getByRole("columnheader", { name: "Khoản" }).className.split(/\s+/);
    expect(khoan).toEqual(expect.arrayContaining(["sticky", "left-0"]));
    expect(screen.getByRole("columnheader", { name: "Tổng" }).className.split(/\s+/)).toEqual(
      expect.arrayContaining(["sticky", "right-24"]),
    );
    expect(screen.getByRole("columnheader", { name: "% doanh thu" }).className.split(/\s+/)).toEqual(
      expect.arrayContaining(["sticky", "right-0"]),
    );
  });

  it("the Lợi nhuận gộp row is bold and shaded, its sticky cells shaded too", () => {
    render(<PnlTableView table={table()} />);
    const head = screen.getByRole("rowheader", { name: /^Lợi nhuận gộp/ });
    const row = head.closest("tr")!;
    expect(row.className).toContain("font-bold");
    expect(row.className).toContain("bg-surface-secondary");
    expect(head.className).toContain("bg-surface-secondary");
    const cells = row.querySelectorAll("td");
    expect(cells[cells.length - 2].className).toContain("bg-surface-secondary");
    expect(cells[cells.length - 1].className).toContain("bg-surface-secondary");
  });

  // K5 review: the sample's rhythm -- every row the same height, so plain
  // rows (Giá vốn) pad like profit rows; month cells hug their buttons.
  it("Giá vốn and Lợi nhuận gộp pad alike; Tổng is semibold, % grey; the panel draws the only frame", () => {
    const { container } = render(<PnlTableView table={table()} />);
    const cls = (el: Element) => el.className.split(/\s+/);
    const plain = screen.getByRole("rowheader", { name: /^Giá vốn/ }).closest("tr")!;
    const shaded = screen.getByRole("rowheader", { name: /^Lợi nhuận gộp/ }).closest("tr")!;
    for (const row of [plain, shaded]) {
      const tds = Array.from(row.querySelectorAll("td"));
      expect(cls(tds[0])).toEqual(expect.arrayContaining(["px-1", "py-1"]));
      expect(cls(tds[tds.length - 2])).toEqual(expect.arrayContaining(["px-3", "py-2", "font-semibold"]));
      expect(cls(tds[tds.length - 1])).toEqual(expect.arrayContaining(["px-3", "py-2", "text-text-secondary"]));
    }
    expect(plain.className).not.toMatch(/hover:/);
    expect(cls(container.querySelector("table")!.parentElement!)).not.toContain("border");
  });

  // BR-UI-007: a span of 24 months is 24 month columns plus Tổng on a computer.
  it("24 months give 24 month headers and Tổng", () => {
    const figures = pnlFigures2026();
    const months = Array.from({ length: 24 }, (_, i) => {
      const y = 2024 + Math.floor((9 + i) / 12);
      const m = ((9 + i) % 12) + 1;
      return { ...figures.months[0], month: `${y}-${String(m).padStart(2, "0")}` };
    });
    render(<PnlTableView table={buildPnlTable({ ...figures, fromMonth: "2024-10", toMonth: "2026-09", months }, "2026-10-09", "trong khoảng đã chọn")} />);
    const heads = screen.getAllByRole("columnheader").map(h => h.getAttribute("aria-label") ?? h.textContent?.trim());
    expect(heads.filter(h => /^\d{2}\/\d{4}/.test(h ?? ""))).toHaveLength(24);
    expect(heads).toContain("10/2024");
    expect(heads).toContain("Tổng");
  });
});
