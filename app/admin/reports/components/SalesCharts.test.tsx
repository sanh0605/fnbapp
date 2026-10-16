// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import SalesCharts from "./SalesCharts";

afterEach(() => cleanup());

const DUMMY_DATA = [
  { label: "08h", amount: 100000 },
  { label: "09h", amount: 250000 },
];

describe("SalesCharts text size on phone (Task 5)", () => {
  it("has no text under 12px (no text-[10px], text-[11px])", () => {
    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={DUMMY_DATA}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );
    expect(container.querySelector(".text-\\[10px\\]")).toBeNull();
    expect(container.innerHTML).not.toMatch(/text-\[(?:[1-9]|1[01])(?:\.\d+)?px\]/);
  });
});
