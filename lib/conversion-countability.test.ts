import { describe, it, expect } from "vitest";
import { wouldLeaveNoCountableConversion } from "@/lib/conversion-countability";

describe("wouldLeaveNoCountableConversion (Plan D D15, P4-P7)", () => {
  // P4: Robusta Dak Mil's real shape -- the only ACTIVE conversion, no others.
  it("P4: refuses when this is the only ACTIVE conversion of the item", () => {
    expect(wouldLeaveNoCountableConversion([], true)).toBe(true);
  });

  // P5: another ACTIVE, non-purchase-only conversion exists (e.g. Túi 500g
  // stays countable while Combo 2 is marked purchase-only).
  it("P5: allows when another ACTIVE conversion is still countable", () => {
    expect(wouldLeaveNoCountableConversion([false], true)).toBe(false);
  });

  it("still refuses when every other ACTIVE conversion is ALSO purchase_only", () => {
    expect(wouldLeaveNoCountableConversion([true, true], true)).toBe(true);
  });

  it("allows when at least one of several other conversions is countable", () => {
    expect(wouldLeaveNoCountableConversion([true, false, true], true)).toBe(false);
  });

  // P6: an INACTIVE sibling conversion is never passed in by the caller in
  // the first place (only ACTIVE ones are fetched) -- an empty array here
  // is exactly what "the only other conversions are INACTIVE" looks like,
  // same result as P4.
  it("P6: an item whose other conversions are all INACTIVE behaves like having none", () => {
    expect(wouldLeaveNoCountableConversion([], true)).toBe(true);
  });

  // P7: unmarking purchase_only can never reduce countability, regardless
  // of what else exists.
  it("P7: never refuses when turning purchase_only off", () => {
    expect(wouldLeaveNoCountableConversion([], false)).toBe(false);
    expect(wouldLeaveNoCountableConversion([true, true], false)).toBe(false);
  });
});
