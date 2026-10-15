// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { PaymentBreakdownSection } from "./PaymentBreakdownSection";

afterEach(() => cleanup());

describe("PaymentBreakdownSection (Ticket G-BC, spec root 1, R2)", () => {
  it("formats the total row text as '39 lượt thanh toán của 38 đơn' for the 06/10 example", () => {
    // 06/10/2026 example: 38 completed orders (23 Tiền mặt, 15 Chuyển khoản),
    // order 261006002002 paid half cash / half transfer -> 23 cash payments, 16 transfer payments
    const payments = [
      { method: "CASH", paymentCount: 23, revenue: 462_000 },
      { method: "BANK_TRANSFER", paymentCount: 16, revenue: 467_000 },
    ];
    const paymentOrderCount = 38;
    const totalRevenue = 929_000;

    render(
      <PaymentBreakdownSection
        paymentBreakdown={payments}
        paymentOrderCount={paymentOrderCount}
        totalRevenue={totalRevenue}
      />
    );

    // Both desktop table and mobile card show the exact payment count and order count text
    const matches = screen.getAllByText("39 lượt thanh toán của 38 đơn");
    expect(matches.length).toBeGreaterThan(0);

    // Total revenue is formatted in the total row
    expect(screen.getAllByText("929,000").length).toBeGreaterThan(0);

    // Row contents are present
    expect(screen.getAllByText("Tiền mặt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chuyển khoản").length).toBeGreaterThan(0);
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
