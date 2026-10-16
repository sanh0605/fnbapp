// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ProductTable from "./ProductTable";

afterEach(() => cleanup());

const ITEMS = [
  { name: "Trà đào", totalQty: 3, totalRevenue: 105000, sizes: { M: 1, L: 2 } },
  { name: "Bạc xỉu", totalQty: 2, totalRevenue: 58000, sizes: { M: 2 } },
];

// Wave K5 (spec 2.4, plan Review Focus 3): the report table uses the shared
// Table set -- the total row sits right under the header, every row cell is
// normal weight, revenue is plain text, not green. Totals are today's sums.
describe("ProductTable on the shared Table set (wave K5)", () => {
  it("the row after the header is Tổng cộng with L 2, M 3, 5 cups, 163,000; then Trà đào", () => {
    const { container } = render(<ProductTable title="Bán chạy" items={ITEMS} uniqueSizes={[]} />);
    const rows = Array.from(container.querySelectorAll("table tr"));
    expect(rows[0].closest("thead")).not.toBeNull();
    const total = Array.from(rows[1].querySelectorAll("td, th")).map((c) => (c.textContent || "").trim());
    expect(total).toEqual(["Tổng cộng", "2", "3", "5", "163,000"]);
    expect(rows[2].textContent).toContain("Trà đào");
  });

  it("no cell in the table is green or bold", () => {
    const { container } = render(<ProductTable title="Bán chạy" items={ITEMS} uniqueSizes={[]} />);
    const table = container.querySelector("table")!;
    expect(table.querySelector(".text-success")).toBeNull();
    expect(table.querySelector("tbody .font-bold, tbody .font-semibold, tbody .font-medium")).toBeNull();
  });

  // K5 review: a long list scrolls inside the card and its column names stay
  // in view (the old table pinned its head; the shared one must too). Sticky
  // only works when the box that scrolls is the table's own parent.
  it("the column names stay in view while a long list scrolls", () => {
    const { container } = render(<ProductTable title="Bán chạy" items={ITEMS} uniqueSizes={[]} />);
    const table = container.querySelector("table")!;
    const scroller = table.parentElement!;
    expect(scroller.className.split(/\s+/)).toEqual(expect.arrayContaining(["max-h-[528px]", "overflow-y-auto"]));
    expect(scroller.parentElement!.closest(".overflow-y-auto")).toBeNull();
    for (const th of Array.from(table.querySelectorAll("thead th"))) {
      expect(th.className.split(/\s+/)).toEqual(expect.arrayContaining(["sticky", "top-0"]));
    }
  });

  it("renders compact table on phone without mobile cards, body rows starting with sticky TableRowHeader (Task 5)", () => {
    const { container } = render(<ProductTable title="Bán chạy" items={ITEMS} uniqueSizes={[]} />);
    // The old md:hidden card version is gone
    expect(container.querySelector(".md\\:hidden")).toBeNull();
    const table = container.querySelector("table")!;
    expect(table.closest(".hidden")).toBeNull();

    // The first cell of each body row is a TableRowHeader with stick="left"
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    expect(bodyRows).toHaveLength(2);
    for (const row of bodyRows) {
      const headerCell = row.querySelector("th[scope='row']")!;
      expect(headerCell).not.toBeNull();
      expect(headerCell.className).toContain("sticky");
      expect(headerCell.className).toContain("left-0");
    }
    expect(bodyRows[0].querySelector("th[scope='row']")!.textContent).toBe("Trà đào");
    expect(bodyRows[1].querySelector("th[scope='row']")!.textContent).toBe("Bạc xỉu");

    // The first header cell has stick="left"
    const firstHeader = table.querySelector("thead th")!;
    expect(firstHeader.className).toContain("sticky");
    expect(firstHeader.className).toContain("left-0");
  });
});
