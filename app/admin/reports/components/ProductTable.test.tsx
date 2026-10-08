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
});
