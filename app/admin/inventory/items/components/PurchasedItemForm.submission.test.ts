import { describe, expect, it } from "vitest";
import { buildConversionSubmission, resolveBaseUnitId } from "./PurchasedItemForm";

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
  it("builds units_json and base_unit from the typed conversion row", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: true,
      isEquipment: false,
      baseUnitId: "U-G",
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.fields) throw new Error("expected fields");
    expect(result.fields.base_unit).toBe("U-G");
    expect(JSON.parse(result.fields.units_json)).toEqual([{ name: "U-BAO", conversion_rate: "500" }]);
  });

  it("resolves the typed unit name (case-insensitively) to its id, the same as the RAW path always did", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: true,
      isEquipment: false,
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
      isEquipment: false,
      baseUnitId: "U-G",
      unitsState: [{ name: "Thùng không tồn tại", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a validation error");
    expect(result.error).toContain("dòng 1");
  });
});

// docs/superpowers/plans/2026-09-01-delete-tier-2-ingredient-groups.md
// section 2.2: base_ingredient_id is no longer part of this function's
// output at all -- RAW now builds the same shape as CONSUMABLE/EQUIPMENT.
describe("buildConversionSubmission -- RAW builds the same shape as CONSUMABLE/EQUIPMENT (2026-09-01)", () => {
  it("sends only units_json/base_unit, no base_ingredient_id field", () => {
    const result = buildConversionSubmission({
      isRaw: true,
      isConsumable: false,
      isEquipment: false,
      baseUnitId: "U-G",
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.fields) throw new Error("expected fields");
    expect(result.fields.base_unit).toBe("U-G");
    expect(Object.keys(result.fields)).toEqual(["base_unit", "units_json"]);
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
      isEquipment: false,
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
      isEquipment: false,
      baseUnitId: "Không rõ",
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(false);
  });
});

// 2026-08-26 (docs/superpowers/plans/2026-08-26-equipment-needs-units.md):
// EQUIPMENT now gets the same treatment as CONSUMABLE -- a purchase line
// should record what the invoice says (e.g. "1 Combo 10"), not force the
// owner into pack-size arithmetic. Replaces the old "neither section"
// behaviour (batch 1 section B3), which was never argued, only asserted.
describe("buildConversionSubmission -- EQUIPMENT gets the same section as CONSUMABLE (2026-08-26 fix)", () => {
  it("builds units_json and base_unit from the typed conversion row", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: false,
      isEquipment: true,
      baseUnitId: "U-G",
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.fields) throw new Error("expected fields");
    expect(result.fields.base_unit).toBe("U-G");
    expect(JSON.parse(result.fields.units_json)).toEqual([{ name: "U-BAO", conversion_rate: "500" }]);
  });

  it("rejects a baseUnitId that is not a real unit id, same as CONSUMABLE/RAW", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: false,
      isEquipment: true,
      baseUnitId: "Cái",
      unitsState: [{ name: "Bao", conversion_rate: "500" }],
      units: UNITS,
    });

    expect(result.ok).toBe(false);
  });
});

// The fields:null branch now only fires when no category is selected at all
// (activeCategory undefined -- all three isX flags false). With a category
// selected, exactly one flag is true, so this path is otherwise unreached.
describe("buildConversionSubmission -- no category selected yet", () => {
  it("returns no fields at all -- nothing to append", () => {
    const result = buildConversionSubmission({
      isRaw: false,
      isConsumable: false,
      isEquipment: false,
      baseUnitId: undefined,
      unitsState: [{ name: "", conversion_rate: "" }],
      units: UNITS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.fields).toBeNull();
  });
});

// docs/superpowers/plans/2026-08-29-unit-belongs-to-the-item.md section 5.1:
// the base unit belongs to the item, not its tier-2 group. Before this
// task, a RAW item's baseUnitId was computed inline in the component as
// `activeBaseIngredient?.base_unit` -- extracted here specifically so the
// group-independence can be asserted directly, the exact behaviour change
// section 6 asks to prove.
describe("resolveBaseUnitId -- the unit belongs to the item, not its group (2026-08-29)", () => {
  it("RAW resolves from the item's own selected unit name, same as CONSUMABLE/EQUIPMENT -- not from any group", () => {
    const kg = resolveBaseUnitId({
      isRaw: true,
      isConsumable: false,
      isEquipment: false,
      selectedBaseUnitName: "kg",
      units: [{ id: "U-KG", name: "kg" }, { id: "U-TRAI", name: "trái" }],
    });
    expect(kg).toBe("U-KG");
  });

  it("a RAW item can choose kg even though nothing about a trái-labelled group is passed in at all -- there is no group input to this function any more", () => {
    // Trái tắc / Trái chanh's real shape: the group's own unit is "trái",
    // bought in "kg". This function never receives the group's unit as an
    // input -- proving the item's choice cannot be overridden by it.
    const result = resolveBaseUnitId({
      isRaw: true,
      isConsumable: false,
      isEquipment: false,
      selectedBaseUnitName: "kg",
      units: [{ id: "U-KG", name: "kg" }, { id: "U-TRAI", name: "trái" }],
    });
    expect(result).toBe("U-KG");
    expect(result).not.toBe("U-TRAI");
  });

  it("CONSUMABLE and EQUIPMENT resolve the same way as RAW", () => {
    const units = [{ id: "U-CAI", name: "cái" }];
    expect(resolveBaseUnitId({ isRaw: false, isConsumable: true, isEquipment: false, selectedBaseUnitName: "cái", units })).toBe("U-CAI");
    expect(resolveBaseUnitId({ isRaw: false, isConsumable: false, isEquipment: true, selectedBaseUnitName: "cái", units })).toBe("U-CAI");
  });

  it("returns undefined when no category type is selected", () => {
    const result = resolveBaseUnitId({
      isRaw: false,
      isConsumable: false,
      isEquipment: false,
      selectedBaseUnitName: "kg",
      units: [{ id: "U-KG", name: "kg" }],
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when the selected name matches no real unit", () => {
    const result = resolveBaseUnitId({
      isRaw: true,
      isConsumable: false,
      isEquipment: false,
      selectedBaseUnitName: "không tồn tại",
      units: [{ id: "U-KG", name: "kg" }],
    });
    expect(result).toBeUndefined();
  });
});
