import { describe, expect, it } from "vitest";
import { buildItemStockById } from "./item-stock-display";

const categories = [
  { id: "NHH-001", system_type: "RAW" },
  { id: "NHH-009", system_type: "EQUIPMENT" },
];
const units = [
  { id: "U-ML", name: "ml" },
  { id: "U-QUA", name: "trái" },
  { id: "U-KG", name: "kg" },
  { id: "U-G", name: "g" },
];

function build(opts: {
  item: { id: string; item_category_id?: string; is_non_inventory?: unknown };
  onHand?: number;
  baseUnit?: string;
  status?: string;
}) {
  const onHandById = new Map<string, number>();
  if (opts.onHand !== undefined) onHandById.set(opts.item.id, opts.onHand);
  return buildItemStockById({
    items: [{ item_category_id: "NHH-001", is_non_inventory: false, ...opts.item }],
    categories,
    conversions: opts.baseUnit
      ? [{ purchased_item_id: opts.item.id, base_unit: opts.baseUnit, status: opts.status ?? "ACTIVE" }]
      : [],
    units,
    onHandById,
  })[opts.item.id];
}

describe("buildItemStockById", () => {
  it("Sữa tươi Mlekovita (SPM-002): 42000 ml shows as 42.000 ml", () => {
    expect(build({ item: { id: "SPM-002" }, onHand: 42000, baseUnit: "U-ML" })).toEqual({
      kind: "figure",
      text: "42,000 ml",
      onHand: 42000,
    });
  });

  it("Trứng gà (SPM-045): 116 trái", () => {
    expect(build({ item: { id: "SPM-045" }, onHand: 116, baseUnit: "U-QUA" })?.text).toBe("116 trái");
  });

  it("Đá viên (SPM-005), non-inventory: untracked, no figure", () => {
    expect(
      build({ item: { id: "SPM-005", is_non_inventory: true }, onHand: 4515000, baseUnit: "U-G" }),
    ).toEqual({ kind: "untracked", text: "Không theo dõi tồn" });
  });

  it('is_non_inventory stored as the string "TRUE" reads as untracked', () => {
    expect(
      build({ item: { id: "SPM-005", is_non_inventory: "TRUE" }, onHand: 10, baseUnit: "U-G" })?.kind,
    ).toBe("untracked");
  });

  it('is_non_inventory stored as the string "true" reads as untracked', () => {
    expect(
      build({ item: { id: "SPM-005", is_non_inventory: "true" }, onHand: 10, baseUnit: "U-G" })?.kind,
    ).toBe("untracked");
  });

  it("an item in an EQUIPMENT category shows Xem ở Tài sản", () => {
    expect(
      build({ item: { id: "SPM-078", item_category_id: "NHH-009" }, onHand: 5, baseUnit: "U-G" }),
    ).toEqual({ kind: "equipment", text: "Xem ở Tài sản" });
  });

  it("equipment wins over non-inventory when both apply", () => {
    expect(
      build({ item: { id: "SPM-078", item_category_id: "NHH-009", is_non_inventory: true }, onHand: 5 }),
    ).toEqual({ kind: "equipment", text: "Xem ở Tài sản" });
  });

  it("a tracked item missing from the on-hand map shows 0 ml, onHand 0", () => {
    expect(build({ item: { id: "SPM-002" }, baseUnit: "U-ML" })).toEqual({
      kind: "figure",
      text: "0 ml",
      onHand: 0,
    });
  });

  it("a negative figure shows as is", () => {
    expect(build({ item: { id: "SPM-045" }, onHand: -5, baseUnit: "U-QUA" })?.text).toBe("-5 trái");
  });

  it("a fraction shows with a decimal comma", () => {
    expect(build({ item: { id: "SPM-X" }, onHand: 0.5, baseUnit: "U-KG" })?.text).toBe("0.5 kg");
  });

  it("rounds to two decimals: 1234.567 kg", () => {
    expect(build({ item: { id: "SPM-X" }, onHand: 1234.567, baseUnit: "U-KG" })?.text).toBe("1,234.57 kg");
  });

  it("only an INACTIVE conversion: the figure alone, no trailing space", () => {
    expect(
      build({ item: { id: "SPM-002" }, onHand: 42000, baseUnit: "U-ML", status: "INACTIVE" })?.text,
    ).toBe("42,000");
  });
});
