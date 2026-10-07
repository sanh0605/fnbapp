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
