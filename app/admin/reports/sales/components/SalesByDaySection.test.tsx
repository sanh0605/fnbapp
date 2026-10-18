// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { SalesByDaySection } from "./SalesByDaySection";

afterEach(() => cleanup());

describe("SalesByDaySection (Ticket G-BC, spec root 1, R1)", () => {
  it("renders daily revenue with formatted dates and total row", () => {
    const days = [
      { label: "2026-10-06", amount: 929_000 },
      { label: "2026-10-07", amount: 1_250_000 },
    ];
    const totalRevenue = 2_179_000;

    const { container } = render(<SalesByDaySection salesByDate={days} totalRevenue={totalRevenue} />);

    // Dates formatted as dd/mm/yyyy - single occurrence because old md:hidden card version is gone
    expect(screen.getAllByText("06/10/2026")).toHaveLength(1);
    expect(screen.getAllByText("07/10/2026")).toHaveLength(1);

    // Revenue formatted
    expect(screen.getAllByText("929,000")).toHaveLength(1);
    expect(screen.getAllByText("1,250,000")).toHaveLength(1);

    // Total row
    expect(screen.getAllByText("2,179,000")).toHaveLength(1);
    expect(screen.getAllByText("Tổng cộng")).toHaveLength(1);

    // Task 5: on phone there is a table, old md:hidden card version is gone
    expect(container.querySelector(".md\\:hidden")).toBeNull();
    const table = container.querySelector("table")!;
    expect(table).not.toBeNull();
    expect(table.closest(".hidden")).toBeNull();
    expect(table.closest(".max-w-md")).not.toBeNull();

    // First cell of each body row is TableRowHeader with stick="left"
    const bodyRows = table.querySelectorAll("tbody.divide-y tr");
    expect(bodyRows).toHaveLength(2);
    for (const row of Array.from(bodyRows)) {
      const headerCell = row.querySelector("th[scope='row']")!;
      expect(headerCell).not.toBeNull();
      expect(headerCell.className).toContain("sticky");
      expect(headerCell.className).toContain("left-0");
    }
    expect(bodyRows[0].querySelector("th[scope='row']")!.textContent).toBe("06/10/2026");
    expect(bodyRows[1].querySelector("th[scope='row']")!.textContent).toBe("07/10/2026");

    // Table header also has sticky left-0 for first column
    const firstHeader = table.querySelector("thead th")!;
    expect(firstHeader.className).toContain("sticky");
    expect(firstHeader.className).toContain("left-0");
  });

  it("renders empty state inside the table without mobile cards (Task 5)", () => {
    const { container } = render(<SalesByDaySection salesByDate={[]} totalRevenue={0} />);
    expect(container.querySelector(".md\\:hidden")).toBeNull();
    const table = container.querySelector("table")!;
    expect(table).not.toBeNull();
    expect(table.closest(".hidden")).toBeNull();
    expect(table.closest(".max-w-md")).not.toBeNull();
    expect(table.textContent).toContain("Không có dữ liệu");
  });
});
