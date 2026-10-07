import { describe, expect, it } from "vitest";
import { buildIssueUnitOptions, describeQuantity, initialUnitQuantity, toBaseQuantity } from "./issue-unit-options";
import type { PackageLine } from "@/lib/stock/stocktake-package-lines";

const pkg = (conversionId: string, purchasedUnitName: string, rate: number, base: string): PackageLine => ({
  conversionId, purchasedItemId: "X", purchasedItemName: "X", sizeLabel: `${purchasedUnitName} ${rate.toLocaleString("vi-VN")} ${base}`,
  conversionRate: rate, baseUnitName: base, purchasedUnitName,
});

describe("issue unit options", () => {
  it("Oatside: Hộp 1.000 ml plus loose ml", () => {
    const o = buildIssueUnitOptions("ml", [pkg("QD-044", "Hộp", 1000, "ml")]);
    expect(o).toEqual([
      { key: "QD-044", label: "Hộp 1.000 ml", factor: 1000, unitName: "Hộp" },
      { key: "BASE", label: "ml (lẻ)", factor: 1, unitName: "ml" },
    ]);
    expect(initialUnitQuantity(2000, o)).toEqual({ key: "QD-044", quantity: 2 });
    expect(describeQuantity(2000, "ml", o)).toBe("2 Hộp (2,000 ml)");
  });

  it("Giấy lót chống tràn: Xấp = 1 Xấp is a single option", () => {
    const o = buildIssueUnitOptions("Xấp", [pkg("QD-080", "Xấp", 1, "Xấp")]);
    expect(o).toHaveLength(1);
    expect(describeQuantity(1, "Xấp", o)).toBe("1 Xấp");
  });

  it("half a Túi 500 g of Phin Đậm, typed as 0,5 Túi or as 250 g loose, both send 250", () => {
    const o = buildIssueUnitOptions("g", [pkg("QD-006", "Túi", 500, "g")]);
    expect(toBaseQuantity(0.5, o[0])).toBe(250);
    expect(toBaseQuantity(250, o[1])).toBe(250);
    expect(toBaseQuantity(0.1 * 3, o[1])).toBe(0.3);
  });

  it("opens in the loose unit when the base quantity is not a whole number of packages", () => {
    const o = buildIssueUnitOptions("g", [pkg("QD-100", "Túi", 454, "g")]);
    expect(initialUnitQuantity(1000, o)).toEqual({ key: "BASE", quantity: 1000 });
  });

  it("opens in the package when the base quantity is a whole number of packages", () => {
    const o = buildIssueUnitOptions("g", [pkg("QD-100", "Túi", 454, "g")]);
    expect(initialUnitQuantity(908, o)).toEqual({ key: "QD-100", quantity: 2 });
  });

  it("1000 ml is exactly one Hộp 1.000 ml", () => {
    const o = buildIssueUnitOptions("ml", [pkg("QD-044", "Hộp", 1000, "ml")]);
    expect(initialUnitQuantity(1000, o)).toEqual({ key: "QD-044", quantity: 1 });
  });

  it("no packages: only the loose unit, described as base", () => {
    const o = buildIssueUnitOptions("g", []);
    expect(o).toEqual([{ key: "BASE", label: "g (lẻ)", factor: 1, unitName: "g" }]);
    expect(describeQuantity(250, "g", o)).toBe("250 g");
  });
});
