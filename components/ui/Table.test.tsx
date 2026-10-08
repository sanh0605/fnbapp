// @vitest-environment jsdom
import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRowHeader,
  TableTotalRow,
  TotalCard,
} from "./Table";

afterEach(cleanup);

function Sample() {
  return (
    <Table aria-label="Phiếu xuất">
      <TableHead>
        <TableHeaderCell>Mặt hàng</TableHeaderCell>
        <TableHeaderCell align="right">Giá trị xuất</TableHeaderCell>
      </TableHead>
      <TableTotalRow>
        <TableCell>Tổng</TableCell>
        <TableCell align="right">149,399đ</TableCell>
      </TableTotalRow>
      <TableBody>
        <TableRow>
          <TableCell>Sữa tươi Mlekovita</TableCell>
          <TableCell align="right">27,100đ</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// Spec 2.4: plain grey headers, a totals row right under them, even rows.
describe("BR-UI-005 Table set", () => {
  it("headers are plain grey text, not capitals", () => {
    render(<Sample />);
    for (const th of screen.getAllByRole("columnheader")) {
      expect(th.className).not.toMatch(/\buppercase\b|\btracking-/);
      expect((th.closest("tr") as HTMLElement).className).not.toMatch(/\buppercase\b|\btracking-/);
      expect(th.className).toContain("text-text-secondary");
    }
  });

  it("number cells line up on the right", () => {
    render(<Sample />);
    const cell = screen.getByText("27,100đ");
    expect(cell.className).toContain("text-right");
    expect(cell.className).toContain("tabular-nums");
  });

  it("no row cell is bold (BR-UI-003)", () => {
    render(<Sample />);
    for (const td of screen.getAllByRole("cell")) {
      expect(td.className).not.toMatch(/\bfont-(bold|semibold|medium)\b/);
    }
  });

  it("the totals row sits right under the header row, on the soft brown", () => {
    render(<Sample />);
    const rows = within(screen.getByRole("table", { name: "Phiếu xuất" })).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Tổng149,399đ");
    expect(rows[1].className).toContain("bg-primary-soft");
  });

  it("on a phone the totals are the first card", () => {
    render(<TotalCard items={[{ label: "Giá trị xuất", value: "149,399đ" }]} />);
    expect(screen.getByText("Giá trị xuất")).toBeInTheDocument();
    expect(screen.getByText("149,399đ")).toBeInTheDocument();
  });
});

// Wave K5: a statement (the P&L, owner-approved sample 2026-09-11) is drawn by
// the same set — label column and total columns stay put while the months
// scroll, subtotal rows are shaded and bold, detail rows small and grey, a
// negative figure red. Pages pass names, never classes.
describe("BR-UI-005 Table set: a statement (wave K5)", () => {
  function Statement() {
    return (
      <Table aria-label="Lãi lỗ">
        <TableHead>
          <TableHeaderCell stick="left">Khoản</TableHeaderCell>
          <TableHeaderCell align="right" aria-label="Tháng 1 năm 2026">T1</TableHeaderCell>
          <TableHeaderCell align="right" stick="right-2">Tổng</TableHeaderCell>
          <TableHeaderCell align="right" stick="right">% doanh thu</TableHeaderCell>
        </TableHead>
        <TableBody>
          <TableRow look="strong">
            <TableRowHeader stick="left">Doanh thu</TableRowHeader>
            <TableCell align="right">100,000</TableCell>
            <TableCell align="right" stick="right-2">100,000</TableCell>
            <TableCell align="right" stick="right">100%</TableCell>
          </TableRow>
          <TableRow look="detail">
            <TableRowHeader stick="left">Cà phê</TableRowHeader>
            <TableCell align="right">60,000</TableCell>
            <TableCell align="right" stick="right-2">60,000</TableCell>
            <TableCell align="right" stick="right">60%</TableCell>
          </TableRow>
          <TableRow look="subtotal">
            <TableRowHeader stick="left">Lợi nhuận ròng</TableRowHeader>
            <TableCell align="right" tone="negative">-5,000</TableCell>
            <TableCell align="right" stick="right-2" tone="negative">-5,000</TableCell>
            <TableCell align="right" stick="right">-5%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }
  const row = (label: string) => screen.getByRole("rowheader", { name: label }).closest("tr") as HTMLElement;

  it("the row label is a row header that does not turn bold by itself", () => {
    render(<Statement />);
    const th = screen.getByRole("rowheader", { name: "Cà phê" });
    expect(th.tagName).toBe("TH");
    expect(th.className).toContain("[font-weight:inherit]");
  });

  it("the label and the two total columns stay put while the months scroll", () => {
    render(<Statement />);
    const cells = Array.from(row("Doanh thu").children) as HTMLElement[];
    expect(cells[0].className).toMatch(/\bsticky\b/);
    expect(cells[0].className).toMatch(/\bleft-0\b/);
    expect(cells[1].className).not.toMatch(/\bsticky\b/);
    expect(cells[2].className).toMatch(/\bright-24\b/);
    expect(cells[3].className).toMatch(/\bright-0\b/);
    const head = screen.getByRole("columnheader", { name: "Tổng" });
    expect(head.className).toMatch(/\bsticky\b/);
    expect(screen.getByRole("columnheader", { name: "Tháng 1 năm 2026" })).toBeInTheDocument();
  });

  it("a subtotal row is shaded and bold, its sticky cells shaded too", () => {
    render(<Statement />);
    const tr = row("Lợi nhuận ròng");
    expect(tr.className).toContain("font-bold");
    expect(tr.className).toContain("bg-surface-secondary");
    const sticky = (Array.from(tr.children) as HTMLElement[]).filter((c) => /\bsticky\b/.test(c.className));
    expect(sticky.length).toBe(3);
    for (const c of sticky) expect(c.className).toContain("bg-surface-secondary");
  });

  it("a strong row is semibold; a detail row is small and grey", () => {
    render(<Statement />);
    expect(row("Doanh thu").className).toContain("font-semibold");
    expect(row("Cà phê").className).toContain("text-[12.5px]");
    expect(row("Cà phê").className).toContain("text-text-secondary");
  });

  it("a cell in a styled row takes the row's size, colour and weight", () => {
    render(<Statement />);
    for (const label of ["Doanh thu", "Cà phê", "Lợi nhuận ròng"]) {
      for (const td of Array.from(row(label).querySelectorAll("td"))) {
        expect(td.className).not.toMatch(/\b(text-sm|text-text-primary|font-normal)\b/);
      }
    }
  });

  it("a negative figure is red", () => {
    render(<Statement />);
    const cells = Array.from(row("Lợi nhuận ròng").children) as HTMLElement[];
    expect(cells[1].className).toContain("text-danger");
    expect(cells[3].className).not.toContain("text-danger");
  });
});

// K5 review: a statement sits inside its own framed panel and must keep the
// 2026-09-11 sample's rhythm -- every row the same height, month cells tight
// around their buttons, the Tổng column semibold, the share column grey.
describe("BR-UI-005 Table set: statement density (K5 review)", () => {
  function Statement() {
    return (
      <Table aria-label="Lãi lỗ" statement>
        <TableHead>
          <TableHeaderCell stick="left">Khoản</TableHeaderCell>
          <TableHeaderCell align="right">T1</TableHeaderCell>
          <TableHeaderCell align="right" stick="right-2">Tổng</TableHeaderCell>
          <TableHeaderCell align="right" stick="right">% doanh thu</TableHeaderCell>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableRowHeader stick="left">Giá vốn</TableRowHeader>
            <TableCell align="right" tight>-40,000</TableCell>
            <TableCell align="right" stick="right-2" strong>-40,000</TableCell>
            <TableCell align="right" stick="right" tone="muted">40%</TableCell>
          </TableRow>
          <TableRow look="subtotal">
            <TableRowHeader stick="left">Lợi nhuận gộp</TableRowHeader>
            <TableCell align="right" tight>60,000</TableCell>
            <TableCell align="right" stick="right-2" strong>60,000</TableCell>
            <TableCell align="right" stick="right" tone="muted">60%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }
  const row = (label: string) => screen.getByRole("rowheader", { name: label }).closest("tr") as HTMLElement;
  const classes = (el: Element) => el.className.split(/\s+/);

  it("draws no frame of its own; its header band is the sample's grey, sticky corners too", () => {
    render(<Statement />);
    const table = screen.getByRole("table", { name: "Lãi lỗ" });
    expect(classes(table.parentElement!)).not.toContain("border");
    expect(classes(table.parentElement!)).not.toContain("rounded-card");
    expect(classes(table.querySelector("thead tr")!)).toContain("bg-surface-secondary");
    const khoan = screen.getByRole("columnheader", { name: "Khoản" });
    expect(classes(khoan)).toEqual(
      expect.arrayContaining(["bg-surface-secondary", "px-3", "py-2", "whitespace-nowrap"]),
    );
    expect(classes(screen.getByRole("columnheader", { name: "% doanh thu" }))).toContain("whitespace-nowrap");
  });

  it("a plain row pads like a styled one, with no hover band", () => {
    render(<Statement />);
    expect(row("Giá vốn").className).not.toMatch(/hover:/);
    const [month, total, share] = Array.from(row("Giá vốn").querySelectorAll("td"));
    expect(classes(month)).toEqual(expect.arrayContaining(["px-1", "py-1"]));
    for (const td of [total, share]) {
      expect(classes(td)).toEqual(expect.arrayContaining(["px-3", "py-2"]));
      expect(classes(td)).not.toContain("px-4");
      expect(classes(td)).not.toContain("text-sm");
    }
    expect(classes(row("Lợi nhuận gộp").querySelector("td")!)).toEqual(
      expect.arrayContaining(["px-1", "py-1"]),
    );
  });

  it("the Tổng column is semibold and the share column grey", () => {
    render(<Statement />);
    const [, total, share] = Array.from(row("Giá vốn").querySelectorAll("td"));
    expect(classes(total)).toContain("font-semibold");
    expect(classes(share)).toContain("text-text-secondary");
  });
});

// K5 review: a long report list scrolls inside its card; the column names stay
// in view while it does.
describe("BR-UI-005 Table set: a pinned head (K5 review)", () => {
  it("the list scrolls inside 528px and every header cell sticks to the top", () => {
    render(
      <Table aria-label="Bán chạy" pinHead>
        <TableHead>
          <TableHeaderCell>Món</TableHeaderCell>
          <TableHeaderCell align="right">Tổng SL</TableHeaderCell>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Trà đào</TableCell>
            <TableCell align="right">3</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const table = screen.getByRole("table", { name: "Bán chạy" });
    expect(table.parentElement!.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["max-h-[528px]", "overflow-y-auto"]),
    );
    for (const th of screen.getAllByRole("columnheader")) {
      expect(th.className.split(/\s+/)).toEqual(expect.arrayContaining(["sticky", "top-0", "bg-page"]));
    }
  });
});
