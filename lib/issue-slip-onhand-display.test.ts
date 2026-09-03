import { describe, expect, it } from "vitest";
import { formatConvertedOnHand } from "./issue-slip-onhand-display";

// section 5. Pre-fix, IssueSlipClient always rendered the base figure
// alone, regardless of the selected package -- so every case below that
// selects a non-1 rate is a wrong VALUE pre-fix, not a missing element:
// the <p> already existed and already rendered text, just the wrong text.
describe("formatConvertedOnHand", () => {
  it("Cay 50 Cai selected against 1.000 Cai on hand: exact division, shown in full", () => {
    expect(formatConvertedOnHand(1000, "Cái", { conversionRate: 50, purchasedUnitName: "Cây" })).toBe(
      "20 Cây (1.000 Cái)",
    );
  });

  it("non-exact division is rendered, not rounded away: 1.030 / 50 = 20,6", () => {
    expect(formatConvertedOnHand(1030, "Cái", { conversionRate: 50, purchasedUnitName: "Cây" })).toBe(
      "20,6 Cây (1.030 Cái)",
    );
  });

  it("a division with more than two decimals rounds to exactly two, not truncated and not a whole number", () => {
    // 1000 / 3 = 333.333... -- never terminates.
    expect(formatConvertedOnHand(1000, "g", { conversionRate: 3, purchasedUnitName: "Túi" })).toBe(
      "333,33 Túi (1.000 g)",
    );
  });

  it("rate 1 shows the base figure alone, not doubled", () => {
    expect(formatConvertedOnHand(45, "Cái", { conversionRate: 1, purchasedUnitName: "Cái" })).toBe("45 Cái");
  });

  it("no package selected falls back to the base figure alone, same as before this fix", () => {
    expect(formatConvertedOnHand(1000, "Cái", undefined)).toBe("1.000 Cái");
  });
});
