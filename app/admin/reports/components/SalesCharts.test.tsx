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

  it("in the hour view with 17 hourly entries, the label of the 16th entry (index 15) carries the class token hidden and the last one (index 16) does not", () => {
    const hourlyData = Array.from({ length: 17 }, (_, i) => ({
      label: `${String(i + 6).padStart(2, "0")}:00`,
      amount: (i + 1) * 10000,
    }));

    const { container } = render(
      <SalesCharts
        salesByHour={hourlyData}
        salesByDate={DUMMY_DATA}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );

    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(17);
    expect(spans[15].classList.contains("hidden")).toBe(true);
    expect(spans[16].classList.contains("hidden")).toBe(false);
    expect(spans[15].classList.contains("md:hidden")).toBe(true);
    expect(spans[16].classList.contains("md:inline")).toBe(true);
    // Bar 3 is labelled on a phone (every third) but not on a computer (every second).
    expect(spans[3].classList.contains("hidden")).toBe(false);
    expect(spans[3].classList.contains("md:hidden")).toBe(true);
  });

  it("in the hour view with 3 hourly entries, the labels of the first and the last entry do not carry the class token hidden, and the middle one does", () => {
    const hourlyData = Array.from({ length: 3 }, (_, i) => ({
      label: `${String(i + 6).padStart(2, "0")}:00`,
      amount: (i + 1) * 10000,
    }));

    const { container } = render(
      <SalesCharts
        salesByHour={hourlyData}
        salesByDate={DUMMY_DATA}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );

    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(3);
    expect(spans[0].classList.contains("hidden")).toBe(false);
    expect(spans[1].classList.contains("hidden")).toBe(true);
    expect(spans[2].classList.contains("hidden")).toBe(false);
  });
});
