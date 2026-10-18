// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { PaymentBreakdownSection } from "./PaymentBreakdownSection";

afterEach(() => cleanup());

describe("PaymentBreakdownSection (Ticket G-BC, spec root 1, R2)", () => {
  it("shows the sentence 'N lượt thanh toán của M đơn' under the table and the count in the total row for the 06/10 example, in a table with sticky TableRowHeader", () => {
    // 06/10/2026 example: 38 completed orders (23 Tiền mặt, 15 Chuyển khoản),
    // order 261006002002 paid half cash / half transfer -> 23 cash payments, 16 transfer payments
    const payments = [
      { method: "CASH", paymentCount: 23, revenue: 462_000 },
      { method: "BANK_TRANSFER", paymentCount: 16, revenue: 467_000 },
    ];
    const paymentOrderCount = 38;
    const totalRevenue = 929_000;

    const { container } = render(
      <PaymentBreakdownSection
        paymentBreakdown={payments}
        paymentOrderCount={paymentOrderCount}
        totalRevenue={totalRevenue}
      />
    );

    // Task 5: old md:hidden card version is gone, table is shown on phone
    expect(container.querySelector(".md\\:hidden")).toBeNull();
    const table = container.querySelector("table")!;
    expect(table).not.toBeNull();
    expect(table.closest(".hidden")).toBeNull();

    // Total row's count cell shows just the number
    const totalRow = table.querySelector("tr.bg-primary-soft")!;
    expect(totalRow).not.toBeNull();
    const totalCells = totalRow.querySelectorAll("td");
    expect(totalCells[1].textContent?.trim()).toBe("39");

    // The sentence appears under the table
    const sentenceUnderTable = container.querySelector("table")!.parentElement!.nextElementSibling;
    expect(sentenceUnderTable?.tagName).toBe("P");
    expect(sentenceUnderTable?.textContent?.trim()).toBe("39 lượt thanh toán của 38 đơn");

    // Exactly 1 occurrence of each text because mobile cards are gone
    expect(screen.getAllByText("39 lượt thanh toán của 38 đơn")).toHaveLength(1);
    expect(screen.getAllByText("929,000")).toHaveLength(1);
    expect(screen.getAllByText("Tiền mặt")).toHaveLength(1);
    expect(screen.getAllByText("Chuyển khoản")).toHaveLength(1);

    // First cell of each body row is TableRowHeader with stick="left"
    const bodyRows = table.querySelectorAll("tbody.divide-y tr");
    expect(bodyRows).toHaveLength(2);
    for (const row of Array.from(bodyRows)) {
      const headerCell = row.querySelector("th[scope='row']")!;
      expect(headerCell).not.toBeNull();
      expect(headerCell.className).toContain("sticky");
      expect(headerCell.className).toContain("left-0");
    }
    expect(bodyRows[0].querySelector("th[scope='row']")!.textContent).toBe("Tiền mặt");
    expect(bodyRows[1].querySelector("th[scope='row']")!.textContent).toBe("Chuyển khoản");

    // Table header also has sticky left-0 for first column
    const firstHeader = table.querySelector("thead th")!;
    expect(firstHeader.className).toContain("sticky");
    expect(firstHeader.className).toContain("left-0");
  });

  it("shows category filter notice when filtering by category", () => {
    render(
      <PaymentBreakdownSection
        paymentBreakdown={[]}
        paymentOrderCount={0}
        totalRevenue={0}
        isCategoryFiltered={true}
      />
    );

    expect(
      screen.getByText(/phương thức thanh toán tính theo cả đơn nên tạm ẩn/)
    ).toBeInTheDocument();
  });
});
