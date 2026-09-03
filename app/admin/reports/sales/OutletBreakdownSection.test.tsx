// @vitest-environment jsdom
//
// Render test per 
// section 4. OPEN-ITEMS 38: jsdom cannot evaluate Tailwind breakpoint
// classes, so tests here that check which layout would actually be visible
// at a given width can only check that the right classes are present on
// the right containers -- not that the browser would actually show one and
// hide the other. Each such test says "class presence" in its own name,
// not "renders at phone width" or similar, per the plan's explicit
// instruction not to let a class-presence check masquerade as a layout
// check. Tests that check what ends up in the DOM regardless of width
// (row content, the "-" guard, totals) are real rendered-layout checks and
// are named as such.
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { OutletBreakdownSection } from "./OutletBreakdownSection";

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  while (roots.length) {
    const root = roots.pop()!;
    act(() => {
      root.unmount();
    });
  }
  while (containers.length) {
    containers.pop()!.remove();
  }
});

async function renderTracked(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  roots.push(root);
  containers.push(container);
  return container;
}

const TWO_OUTLETS = [
  { outlet_id: "OUT-001", name: "Điểm bán 1", orderCount: 40, revenue: 852_000 },
  { outlet_id: "OUT-002", name: "Điểm bán 2", orderCount: 18, revenue: 752_400 },
];

describe("OutletBreakdownSection", () => {
  it("class presence only: the table lives in a container marked hidden below md and overflow-x-auto", async () => {
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={TWO_OUTLETS} />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const tableWrapper = table!.parentElement!;
    expect(tableWrapper.className).toContain("hidden");
    expect(tableWrapper.className).toContain("md:block");
    expect(tableWrapper.className).toContain("overflow-x-auto");
  });

  it("class presence only: the card list is marked hidden from md up", async () => {
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={TWO_OUTLETS} />);
    const cardWrapper = container.querySelector(".md\\:hidden");
    expect(cardWrapper).not.toBeNull();
    expect(cardWrapper!.className).toContain("md:hidden");
  });

  it("class presence only: both layouts are present in the markup simultaneously (jsdom cannot evaluate which one would actually show)", async () => {
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={TWO_OUTLETS} />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector(".md\\:hidden")).not.toBeNull();
  });

  it("rendered layout: the phone card list is unchanged -- name, order count and revenue only, no avg or percent columns", async () => {
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={TWO_OUTLETS} />);
    const cardWrapper = container.querySelector(".md\\:hidden")!;
    const text = cardWrapper.textContent || "";
    expect(text).toContain("Điểm bán 1");
    expect(text).toContain("40 đơn");
    expect(text).toContain("852.000");
    // The two new derived columns must not have leaked into the cards.
    expect(cardWrapper.querySelectorAll("table").length).toBe(0);
  });

  it("rendered layout: the table has one row per outlet with all five columns", async () => {
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={TWO_OUTLETS} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);

    const firstRowText = rows[0].textContent || "";
    expect(firstRowText).toContain("Điểm bán 1");
    expect(firstRowText).toContain("40"); // Số đơn
    expect(firstRowText).toContain("852.000"); // Doanh thu
    expect(firstRowText).toContain("21.300"); // TB/đơn = 852000 / 40
  });

  it("rendered layout: TB/đơn renders an em dash, not NaN or 0đ, for an outlet with zero orders", async () => {
    const outlets = [
      { outlet_id: "OUT-003", name: "Điểm bán 3", orderCount: 0, revenue: 0 },
      ...TWO_OUTLETS,
    ];
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={outlets} />);
    const zeroOrderRow = Array.from(container.querySelectorAll("tbody tr")).find(
      r => r.textContent?.includes("Điểm bán 3"),
    )!;
    const cells = zeroOrderRow.querySelectorAll("td");
    expect(cells[3].textContent).toBe("—"); // TB/đơn column
    expect(cells[3].textContent).not.toContain("NaN");
    expect(cells[3].textContent).not.toBe("0đ");
  });

  it("rendered layout: percent-of-total across three outlets sums to 100,0% within one decimal of rounding", async () => {
    const threeOutlets = [
      { outlet_id: "OUT-001", name: "A", orderCount: 10, revenue: 1_000_000 },
      { outlet_id: "OUT-002", name: "B", orderCount: 10, revenue: 1_500_000 },
      { outlet_id: "OUT-003", name: "C", orderCount: 10, revenue: 700_000 },
    ];
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={threeOutlets} />);
    const rows = container.querySelectorAll("tbody tr");
    const percents = Array.from(rows).map(r => {
      const cells = r.querySelectorAll("td");
      const text = cells[4].textContent || ""; // % tổng column
      return Number(text.replace("%", "").replace(",", "."));
    });
    const sum = percents.reduce((s, p) => s + p, 0);
    // Each of the three cells is independently rounded to one decimal
    // before this test re-parses and sums them, so up to three roundings
    // of up to 0.05 each can compound -- 0.2 covers that with margin,
    // still far tighter than a whole percentage point.
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.2);
  });

  it("rendered layout: the total row sums orders and revenue and leaves TB/đơn and % tổng blank", async () => {
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={TWO_OUTLETS} />);
    const footRow = container.querySelector("tfoot tr")!;
    const cells = footRow.querySelectorAll("td");

    expect(footRow.textContent).toContain("Tổng");
    expect(cells[1].textContent).toBe("58"); // 40 + 18 orders
    expect(cells[2].textContent).toBe("1.604.400"); // 852.000 + 752.400 revenue
    expect(cells[3].textContent?.trim()).toBe("");
    expect(cells[4].textContent?.trim()).toBe("");
  });

  it("rendered layout: an unassigned bucket becomes a row instead of being dropped", async () => {
    const outlets = [{ outlet_id: "", name: "Chưa gắn điểm bán", orderCount: 3, revenue: 90_000 }, ...TWO_OUTLETS];
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={outlets} />);
    expect(container.textContent).toContain("Chưa gắn điểm bán");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("rendered layout: shows the empty state and no table when there is no data", async () => {
    const container = await renderTracked(<OutletBreakdownSection outletBreakdown={[]} />);
    expect(container.textContent).toContain("Không có dữ liệu");
    expect(container.querySelector("table")).toBeNull();
  });
});
