// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import React from "react";
import { MonthCard } from "./MonthCard";

afterEach(() => cleanup());

describe("MonthCard (Ticket G-BC, spec root 2, R3)", () => {
  it("renders month label using formatMonthLabel, two lines Hàng dùng and Hao hụt, and total", () => {
    render(
      <MonthCard
        yearMonth="2026-09"
        usedValue={8_454_110}
        shrinkageValue={0}
      />
    );

    // Month label and total
    const topRow = screen.getByText("Tháng 09/2026").parentElement!;
    expect(within(topRow).getByText("8,454,110đ")).toBeInTheDocument();

    // Line 1: Hàng dùng
    expect(screen.getByText("Hàng dùng")).toBeInTheDocument();
    const usedRow = screen.getByText("Hàng dùng").parentElement!;
    expect(within(usedRow).getByText("8,454,110đ")).toBeInTheDocument();

    // Line 2: Hao hụt
    expect(screen.getByText("Hao hụt")).toBeInTheDocument();
    const shrinkageRow = screen.getByText("Hao hụt").parentElement!;
    expect(within(shrinkageRow).getByText("0đ")).toBeInTheDocument();
  });
});
