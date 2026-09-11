// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildPnlTable } from "@/lib/reports/profit-and-loss-table";
import { pnlFigures2026 } from "../__fixtures__/pnl-2026";
import { PnlChart } from "./PnlChart";

afterEach(() => cleanup());

describe("PnlChart", () => {
  it("shows the section heading", () => {
    render(<PnlChart table={buildPnlTable(pnlFigures2026(), "2026-09-11")} />);
    expect(screen.getByRole("heading", { name: "Lãi lỗ từng tháng và luỹ kế" })).toBeInTheDocument();
  });

  it("labels every bar and every axis tick with one unit, and marks the loss month with a minus", () => {
    const { container } = render(<PnlChart table={buildPnlTable(pnlFigures2026(), "2026-09-11")} />);
    const svgTexts = Array.from(container.querySelectorAll("svg text")).map(t => t.textContent ?? "");
    // Bar labels and tick labels are the only text nodes shaped like a
    // compact money figure ("-32.372,96k", "10.000k", "-49,23k"...); month
    // heads ("08/26", "08/26*") and the luỹ kế end label are excluded.
    const compactLabels = svgTexts.filter(t => /^-?[\d.,]+(k|tr)$/.test(t));
    expect(compactLabels.length).toBeGreaterThan(0);

    const units = new Set(compactLabels.map(t => (t.endsWith("tr") ? "tr" : "k")));
    expect(units.size).toBe(1);

    const lossLabel = compactLabels.find(t => t.startsWith("-"));
    expect(lossLabel).toBeDefined();
  });
});
