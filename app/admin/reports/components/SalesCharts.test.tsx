// @vitest-environment jsdom
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
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
    expect(spans[3].classList.contains("hidden")).toBe(true);
    expect(spans[4].classList.contains("hidden")).toBe(false);

    expect(spans[0].parentElement?.classList.contains("self-start")).toBe(true);
    expect(spans[16].parentElement?.classList.contains("self-end")).toBe(true);
    expect(spans[8].parentElement?.classList.contains("self-start")).toBe(false);
    expect(spans[8].parentElement?.classList.contains("self-end")).toBe(false);
  });

  it("in the hour view with 3 hourly entries, all three labels show and none is pushed to an edge", () => {
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
    expect(spans[1].classList.contains("hidden")).toBe(false);
    expect(spans[2].classList.contains("hidden")).toBe(false);

    expect(spans[0].parentElement?.classList.contains("self-start")).toBe(false);
    expect(spans[2].parentElement?.classList.contains("self-end")).toBe(false);
  });

  it("formats day and month labels for display", () => {
    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={[
          { label: "2026-10-01", amount: 1000 },
          { label: "2026-10-17", amount: 2000 },
        ]}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={[{ label: "2026-10", amount: 3000 }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo ngày" }));
    const daySpans = container.querySelectorAll(".h-4 span");
    expect(daySpans).toHaveLength(2);
    expect(daySpans[0].textContent).toBe("01/10");
    expect(daySpans[1].textContent).toBe("17/10");

    fireEvent.click(screen.getByRole("button", { name: "Theo tháng" }));
    const monthSpans = container.querySelectorAll(".h-4 span");
    expect(monthSpans).toHaveLength(1);
    expect(monthSpans[0].textContent).toBe("10/2026");
  });

  it("in day view with 16 entries, spans without hidden class are exactly indices [0, 4, 8, 15]", () => {
    const dateData = Array.from({ length: 16 }, (_, i) => ({
      label: `2026-10-${String(i + 1).padStart(2, "0")}`,
      amount: (i + 1) * 10000,
    }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={dateData}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo ngày" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(16);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 4, 8, 15]);
  });

  it("in month view with 7 entries, visible spans are [0, 2, 4, 6] and the first and last sit at the column edges", () => {
    const monthData = [
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ].map((label, i) => ({ label, amount: (i + 1) * 10000 }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={DUMMY_DATA}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={monthData}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo tháng" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(7);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 2, 4, 6]);

    expect(spans[0].parentElement?.classList.contains("self-start")).toBe(true);
    expect(spans[6].parentElement?.classList.contains("self-end")).toBe(true);
    expect(spans[3].parentElement?.classList.contains("self-start")).toBe(false);
    expect(spans[3].parentElement?.classList.contains("self-end")).toBe(false);
  });

  it("in month view with 4 entries, no span has hidden and edges are not aligned to start/end", () => {
    const monthData = [
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ].map((label, i) => ({ label, amount: (i + 1) * 10000 }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={DUMMY_DATA}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={monthData}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo tháng" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(4);
    spans.forEach((span) => {
      expect(span.classList.contains("hidden")).toBe(false);
    });
    expect(spans[0].parentElement?.classList.contains("self-start")).toBe(false);
    expect(spans[3].parentElement?.classList.contains("self-end")).toBe(false);
  });

  it("in day view with 14 entries, spans without hidden class are exactly indices [0, 3, 6, 9, 13]", () => {
    const dateData = Array.from({ length: 14 }, (_, i) => ({
      label: `2026-10-${String(i + 1).padStart(2, "0")}`,
      amount: (i + 1) * 10000,
    }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={dateData}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo ngày" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(14);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 3, 6, 9, 13]);
  });

  it("in day view with 21 entries, spans without hidden class are exactly indices [0, 5, 10, 15, 20]", () => {
    const dateData = Array.from({ length: 21 }, (_, i) => ({
      label: `2026-10-${String(i + 1).padStart(2, "0")}`,
      amount: (i + 1) * 10000,
    }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={dateData}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo ngày" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(21);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 5, 10, 15, 20]);
  });

  it("in month view with 8 entries, visible spans are [0, 3, 7]", () => {
    const monthData = [
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ].map((label, i) => ({ label, amount: (i + 1) * 10000 }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={DUMMY_DATA}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={monthData}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo tháng" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(8);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 3, 7]);
  });

  it("in month view with 12 entries, visible spans are [0, 4, 11]", () => {
    const monthData = [
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ].map((label, i) => ({ label, amount: (i + 1) * 10000 }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={DUMMY_DATA}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={monthData}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo tháng" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(12);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 4, 11]);
  });

  it("tab container has hide-scrollbar class", () => {
    render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={DUMMY_DATA}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );
    const tabContainer = screen.getByRole("button", { name: "Theo giờ" }).parentElement;
    expect(tabContainer?.classList.contains("hide-scrollbar")).toBe(true);
  });

  it("in day view with 7 entries, spans without hidden class are exactly indices [0, 2, 4, 6]", () => {
    const dateData = Array.from({ length: 7 }, (_, i) => ({
      label: `2026-10-${String(i + 1).padStart(2, "0")}`,
      amount: (i + 1) * 10000,
    }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={dateData}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo ngày" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(7);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 2, 4, 6]);
  });

  it("on a 561 px wide chart (a 1280 screen) more labels show", () => {
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) { this.cb = cb; }
      observe() { this.cb([{ contentRect: { width: 561 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      const dateData = Array.from({ length: 16 }, (_, i) => ({
        label: `2026-10-${String(i + 1).padStart(2, "0")}`,
        amount: (i + 1) * 10000,
      }));
      const monthData = [
        "2026-04",
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
      ].map((label, i) => ({ label, amount: (i + 1) * 10000 }));

      const { container } = render(
        <SalesCharts
          salesByHour={DUMMY_DATA}
          salesByDate={dateData}
          salesByDayOfWeek={DUMMY_DATA}
          salesByMonth={monthData}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Theo ngày" }));
      let spans = container.querySelectorAll(".h-4 span");
      expect(spans).toHaveLength(16);
      const visibleDayIndices = Array.from(spans).flatMap((span, idx) =>
        span.classList.contains("hidden") ? [] : [idx]
      );
      expect(visibleDayIndices).toEqual([0, 2, 4, 6, 8, 10, 12, 15]);

      fireEvent.click(screen.getByRole("button", { name: "Theo tháng" }));
      spans = container.querySelectorAll(".h-4 span");
      expect(spans).toHaveLength(7);
      spans.forEach((span) => {
        expect(span.classList.contains("hidden")).toBe(false);
      });
      expect(spans[0].parentElement?.classList.contains("self-start")).toBe(false);
      expect(spans[6].parentElement?.classList.contains("self-end")).toBe(false);

      const boxes = container.querySelectorAll(".group-hover\\:opacity-100");
      expect(boxes[0].classList.contains("self-start")).toBe(false);
      expect(boxes[0].classList.contains("self-end")).toBe(false);
      expect(boxes[6].classList.contains("self-start")).toBe(false);
      expect(boxes[6].classList.contains("self-end")).toBe(false);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it("in day view with 31 entries, every bar fits: columns can shrink, the box clips instead of scrolling, and visible labels are [0, 8, 16, 30]", () => {
    const dateData = Array.from({ length: 31 }, (_, i) => ({
      label: `2026-10-${String(i + 1).padStart(2, "0")}`,
      amount: (i + 1) * 10000,
    }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={dateData}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo ngày" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(31);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 8, 16, 30]);

    const columns = container.querySelectorAll(".group");
    expect(columns).toHaveLength(31);
    columns.forEach((col) => {
      expect(col.classList.contains("min-w-0")).toBe(true);
      expect(col.classList.contains("min-w-[8px]")).toBe(false);
    });

    const barsBox = container.querySelector(".pb-4.overflow-x-clip");
    expect(barsBox).not.toBeNull();
    expect(barsBox?.classList.contains("gap-1")).toBe(false);
    expect(barsBox?.classList.contains("sm:gap-2")).toBe(false);
    expect(barsBox?.classList.contains("overflow-x-auto")).toBe(false);
  });

  it("in day view with 92 entries (a quarter), every bar fits and visible labels are [0, 22, 44, 66, 91]", () => {
    const dateData = Array.from({ length: 92 }, (_, i) => ({
      label: new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10),
      amount: (i + 1) * 10000,
    }));

    const { container } = render(
      <SalesCharts
        salesByHour={DUMMY_DATA}
        salesByDate={dateData}
        salesByDayOfWeek={DUMMY_DATA}
        salesByMonth={DUMMY_DATA}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Theo ngày" }));
    const spans = container.querySelectorAll(".h-4 span");
    expect(spans).toHaveLength(92);
    const visibleIndices = Array.from(spans).flatMap((span, idx) =>
      span.classList.contains("hidden") ? [] : [idx]
    );
    expect(visibleIndices).toEqual([0, 22, 44, 66, 91]);

    const columns = container.querySelectorAll(".group");
    expect(columns).toHaveLength(92);

    const tracks = container.querySelectorAll(".bg-primary-soft");
    expect(tracks).toHaveLength(92);
    tracks.forEach((track) => {
      expect(track.classList.contains("w-3/4")).toBe(true);
      expect(track.classList.contains("w-full")).toBe(false);
    });
  });

  it("in the hour view with 18 entries, value boxes near the chart edges move to the column edge", () => {
    const hourlyData = Array.from({ length: 18 }, (_, i) => ({
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

    const boxes = container.querySelectorAll(".group-hover\\:opacity-100");
    expect(boxes).toHaveLength(18);
    expect(boxes[0].classList.contains("self-start")).toBe(true);
    expect(boxes[1].classList.contains("self-start")).toBe(true);
    expect(boxes[16].classList.contains("self-end")).toBe(true);
    expect(boxes[17].classList.contains("self-end")).toBe(true);

    expect(boxes[2].classList.contains("self-start")).toBe(false);
    expect(boxes[2].classList.contains("self-end")).toBe(false);
    expect(boxes[15].classList.contains("self-start")).toBe(false);
    expect(boxes[15].classList.contains("self-end")).toBe(false);
  });
});
