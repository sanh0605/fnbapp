import { describe, expect, it } from "vitest";
import { buildPackageLines, type PurchasedItemConversion } from "@/lib/stocktake-package-lines";

// Real shapes, measured against production 2026-08-07 (Plan D section 4/6).
const DAU_SAY: PurchasedItemConversion[] = [
  { conversionId: "QD-038", purchasedItemId: "SPM-033", purchasedItemName: "Dâu sấy", purchasedUnitName: "Túi", baseUnitName: "g", conversionRate: 100, status: "ACTIVE" },
  { conversionId: "QD-051", purchasedItemId: "SPM-033", purchasedItemName: "Dâu sấy", purchasedUnitName: "Túi", baseUnitName: "g", conversionRate: 500, status: "ACTIVE" },
  { conversionId: "QD-043", purchasedItemId: "SPM-033", purchasedItemName: "Dâu sấy", purchasedUnitName: "Túi", baseUnitName: "g", conversionRate: 1000, status: "ACTIVE" },
];

const KEM_WHIPPING: PurchasedItemConversion[] = [
  { conversionId: "QD-054", purchasedItemId: "SPM-014", purchasedItemName: "Kem whipping Anchor", purchasedUnitName: "Hộp", baseUnitName: "ml", conversionRate: 250, status: "ACTIVE" },
  { conversionId: "QD-019", purchasedItemId: "SPM-014", purchasedItemName: "Kem whipping Anchor", purchasedUnitName: "Hộp", baseUnitName: "ml", conversionRate: 1000, status: "ACTIVE" },
];

describe("buildPackageLines", () => {
  it("Dâu sấy: three same-named conversions become three distinct, correctly labelled lines", () => {
    const lines = buildPackageLines(DAU_SAY);
    expect(lines).toHaveLength(3);
    expect(lines.map(l => l.sizeLabel)).toEqual(["Túi 100 g", "Túi 500 g", "Túi 1.000 g"]);
    // Ascending by size, not by conversion id or insertion order.
    expect(lines.map(l => l.conversionRate)).toEqual([100, 500, 1000]);
    expect(new Set(lines.map(l => l.conversionId)).size).toBe(3);
  });

  it("Kem whipping Anchor: two same-named conversions, ten times apart, stay distinct", () => {
    const lines = buildPackageLines(KEM_WHIPPING);
    expect(lines).toHaveLength(2);
    expect(lines.map(l => l.sizeLabel)).toEqual(["Hộp 250 ml", "Hộp 1.000 ml"]);
  });

  it("a single-conversion item (the 48-item common case) produces exactly one line", () => {
    const lines = buildPackageLines([
      { conversionId: "QD-001", purchasedItemId: "SPM-001", purchasedItemName: "Trứng gà", purchasedUnitName: "trái", baseUnitName: "trái", conversionRate: 1, status: "ACTIVE" },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].sizeLabel).toBe("trái 1 trái");
  });

  it("C8: an inactive conversion is dropped, not shown as a line", () => {
    const lines = buildPackageLines([
      ...DAU_SAY,
      { conversionId: "QD-999", purchasedItemId: "SPM-033", purchasedItemName: "Dâu sấy", purchasedUnitName: "Bao", baseUnitName: "g", conversionRate: 5000, status: "INACTIVE" },
    ]);
    expect(lines).toHaveLength(3);
    expect(lines.some(l => l.conversionId === "QD-999")).toBe(false);
  });

  it("multiple purchased items stay grouped together, sorted by name then size", () => {
    const lines = buildPackageLines([...KEM_WHIPPING, ...DAU_SAY]);
    expect(lines.map(l => l.purchasedItemName)).toEqual([
      "Dâu sấy", "Dâu sấy", "Dâu sấy",
      "Kem whipping Anchor", "Kem whipping Anchor",
    ]);
  });

  it("returns an empty list for no conversions", () => {
    expect(buildPackageLines([])).toEqual([]);
  });
});
