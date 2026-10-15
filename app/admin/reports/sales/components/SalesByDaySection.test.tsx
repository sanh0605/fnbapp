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

    render(<SalesByDaySection salesByDate={days} totalRevenue={totalRevenue} />);

    // Dates formatted as dd/mm/yyyy
    expect(screen.getAllByText("06/10/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("07/10/2026").length).toBeGreaterThan(0);

    // Revenue formatted
    expect(screen.getAllByText("929,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,250,000").length).toBeGreaterThan(0);

    // Total row
    expect(screen.getAllByText("2,179,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tổng cộng").length).toBeGreaterThan(0);
  });
});
