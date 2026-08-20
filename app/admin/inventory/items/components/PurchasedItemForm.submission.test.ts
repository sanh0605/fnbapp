import { describe, expect, it } from "vitest";
import { buildConversionSubmission } from "./PurchasedItemForm";

// Batch 1, item B, section B4: "assert units_json is present in the
// payload with the typed values. That assertion is the one that fails
// today, and it is the whole point." buildConversionSubmission is
// handleSubmit's own payload-building logic, extracted unchanged (see the
// comment on it in PurchasedItemForm.tsx for why: react-dom 18.3.1, what
// this repo's package.json declares and what vitest resolves, does not
// support a function-valued <form action> the way Next.js's own build
// pipeline does at runtime -- no dispatched event reaches handleSubmit
// under plain vitest+jsdom, verified directly before writing this file).
const UNITS = [
  { id: "U-BAO", name: "Bao" },
  { id: "U-G", name: "g" },
];

describe("buildConversionSubmission -- CONSUMABLE (Batch 1, item B)", () => {
  it("builds units_json and base_unit from the typed conversion row, with no base_ingredient_id", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: true,
      selectedBaseIngredientId: "",
      baseUnitId: "U-G",
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.fields) throw new Error("expected fields");
    expect(result.fields.base_unit).toBe("U-G");
    expect(JSON.parse(result.fields.units_json)).toEqual([{ name: "U-BAO", conversion_rate: "500" }]);
    // Section B3: a consumable must not be forced to invent an ingredient.
    expect(result.fields.base_ingredient_id).toBeUndefined();
  });

  it("resolves the typed unit name (case-insensitively) to its id, the same as the RAW path always did", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: true,
      selectedBaseIngredientId: "",
      baseUnitId: "U-G",
      unitsState: [{ name: "bao", conversion_rate: "500" }], // typed lowercase
      units: UNITS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.fields) throw new Error("expected fields");
    expect(JSON.parse(result.fields.units_json)).toEqual([{ name: "U-BAO", conversion_rate: "500" }]);
  });

  it("refuses an unrecognised purchase-unit name, naming the line", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: true,
      selectedBaseIngredientId: "",
      baseUnitId: "U-G",
      unitsState: [{ name: "Thùng không tồn tại", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a validation error");
    expect(result.error).toContain("dòng 1");
  });
});

describe("buildConversionSubmission -- RAW, unaffected by the consumable change (section B4)", () => {
  it("still sends base_ingredient_id alongside units_json/base_unit", () => {
    const result = buildConversionSubmission({
      isRaw: true,
      isConsumable: false,
      selectedBaseIngredientId: "ING-032",
      baseUnitId: "U-G",
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.fields) throw new Error("expected fields");
    expect(result.fields.base_ingredient_id).toBe("ING-032");
    expect(result.fields.base_unit).toBe("U-G");
  });
});

// 2026-08-20 fix (docs/superpowers/plans/2026-08-20-consumable-base-unit-mismatch.md
// section 3): "close the hole rather than only the instance." baseUnitId
// must already be a real unit id by the time it reaches here -- a name (the
// exact shape of the original defect) fails visibly instead of writing a
// corrupt uom_conversions.base_unit row.
describe("buildConversionSubmission -- rejects a baseUnitId that is not a real unit id (2026-08-20 fix)", () => {
  it("a unit NAME passed as baseUnitId (the original defect's shape) is refused, not silently written", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: true,
      selectedBaseIngredientId: "",
      baseUnitId: "Cái", // a name, not one of UNITS' ids ("U-BAO", "U-G")
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a validation error");
    expect(result.error).toBeTruthy();
  });

  it("also refuses on the RAW path -- the guard is not consumable-specific", () => {
    const result = buildConversionSubmission({
      isRaw: true,
      isConsumable: false,
      selectedBaseIngredientId: "ING-032",
      baseUnitId: "Không rõ",
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(false);
  });
});

describe("buildConversionSubmission -- EQUIPMENT gets neither section (section B3)", () => {
  it("returns no fields at all -- nothing to append", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: false,
      selectedBaseIngredientId: "",
      baseUnitId: undefined,
      unitsState: [{ name: "", conversion_rate: "" }],
      units: UNITS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.fields).toBeNull();
  });
});
