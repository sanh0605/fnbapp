// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PnlRow } from "@/lib/reports/profit-and-loss-table";
import { cellText, cellTone, isCostRow, NoteMarks, shownMoney } from "./pnl-display";

afterEach(() => cleanup());

const costRow: PnlRow = { key: "cogs", label: "Giá vốn", kind: "cost", unit: "money", cells: [], total: null, shareOfRevenue: null };
const expenseRow: PnlRow = { key: "depreciation", label: "Khấu hao", kind: "expense", unit: "money", cells: [], total: null, shareOfRevenue: null };
const netRow: PnlRow = { key: "netProfit", label: "Lợi nhuận ròng", kind: "net", unit: "money", cells: [], total: null, shareOfRevenue: null };
const marginRow: PnlRow = { key: "margin", label: "Biên lợi nhuận", kind: "margin", unit: "percent", cells: [], total: null, shareOfRevenue: null };

describe("isCostRow", () => {
  it("is true for cost and expense rows, false otherwise", () => {
    expect(isCostRow(costRow)).toBe(true);
    expect(isCostRow(expenseRow)).toBe(true);
    expect(isCostRow(netRow)).toBe(false);
  });
});

describe("shownMoney", () => {
  it("negates a cost row's value", () => {
    expect(shownMoney(costRow, 46_418_990)).toBe(-46_418_990);
  });
  it("keeps a non-cost row's value as is", () => {
    expect(shownMoney(netRow, -32_372_964)).toBe(-32_372_964);
  });
  it("never turns a zero cost value into -0", () => {
    expect(Object.is(shownMoney(costRow, 0), -0)).toBe(false);
    expect(shownMoney(costRow, 0)).toBe(0);
  });
});

describe("cellText", () => {
  it("shows a cost row's value with a minus", () => {
    expect(cellText(costRow, 46_418_990)).toBe("-46.418.990");
  });
  it("shows a net row's negative value with a minus", () => {
    expect(cellText(netRow, -32_372_964)).toBe("-32.372.964");
  });
  it("shows a money cell that is exactly 0 as an en dash", () => {
    expect(cellText(costRow, 0)).toBe("–");
    expect(cellText(netRow, 0)).toBe("–");
  });
  it("shows a percent row's null value as the placeholder", () => {
    expect(cellText(marginRow, null)).toBe("---");
  });
  it("shows a percent row's value via formatPercent, unnegated by isCostRow", () => {
    expect(cellText(marginRow, -183.1)).toBe("-183,10%");
  });
});

describe("cellTone", () => {
  it("is not red for a cost row's negative-shown value", () => {
    expect(cellTone(costRow, 46_418_990)).toBe("");
  });
  it("is red for a net row's negative value", () => {
    expect(cellTone(netRow, -32_372_964)).toBe("text-danger");
  });
  it("is red for a margin row's negative percent", () => {
    expect(cellTone(marginRow, -183.1)).toBe("text-danger");
  });
  it("is not red for a null value", () => {
    expect(cellTone(marginRow, null)).toBe("");
  });
});

describe("NoteMarks", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(<NoteMarks numbers={[]} />);
    expect(container.querySelector("sup")).toBeNull();
  });
  it("joins several numbers with a comma, in one <sup>", () => {
    const { container } = render(<NoteMarks numbers={[1, 3]} />);
    const sups = container.querySelectorAll("sup");
    expect(sups).toHaveLength(1);
    expect(sups[0].textContent).toBe("1,3");
  });
});
