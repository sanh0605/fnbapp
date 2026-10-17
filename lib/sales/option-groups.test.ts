import { describe, expect, it } from "vitest";
import { canAddPortion, litOptionId, optionGroupsForProduct, orderPicks, pickOne, type OptionGroup, type OptionRow } from "./option-groups";

const g = (o: Partial<OptionGroup>): OptionGroup => ({ id: "MG-1", name: "X", selection_mode: "MANY", max_total: null, allow_standalone: false, sort_order: 50, status: "ACTIVE", ...o });
const opt = (o: Partial<OptionRow>): OptionRow => ({ id: "M", name: "M", price: 0, status: "ACTIVE", group_id: "MG-1", is_default: false, max_qty: null, product_id: null, ...o });

const sugar = g({ id: "MG-2", name: "Mức đường", selection_mode: "ONE", sort_order: 1 });
const topping = g({ id: "MG-1", name: "Thêm Topping", sort_order: 50, max_total: 3, allow_standalone: true });
const milk = g({ id: "MG-3", name: "Loại sữa", selection_mode: "ONE", sort_order: 3 });
const options = [
  opt({ id: "S1", name: "Ít đường", group_id: "MG-2" }),
  opt({ id: "S2", name: "Bình thường", group_id: "MG-2", is_default: true }),
  opt({ id: "T1", name: "Trân châu trắng", price: 5000, max_qty: 2 }),
  opt({ id: "T2", name: "Kem muối", price: 4000 }),
  opt({ id: "K1", name: "Sữa tươi", group_id: "MG-3", is_default: true }),
  opt({ id: "K2", name: "Sữa yến mạch", group_id: "MG-3", price: 8000 }),
];
const links = [
  { group_id: "MG-1", product_id: "TRA" }, { group_id: "MG-2", product_id: "TRA" }, { group_id: "MG-3", product_id: "TRA" },
  { group_id: "MG-1", product_id: "CAFE" },
];

describe("optionGroupsForProduct", () => {
  it("gives a dish only its ticked, active groups in making order", () => {
    const tra = optionGroupsForProduct("TRA", [topping, sugar, milk], links, options);
    expect(tra.map((x) => x.group.name)).toEqual(["Mức đường", "Loại sữa", "Thêm Topping"]);
    expect(optionGroupsForProduct("CAFE", [topping, sugar, milk], links, options).map((x) => x.group.name)).toEqual(["Thêm Topping"]);
    expect(optionGroupsForProduct("KHOAI", [topping, sugar, milk], links, options)).toEqual([]);
  });
  it("drops stopped groups, stopped options and groups left empty", () => {
    const stopped = optionGroupsForProduct("TRA", [topping, { ...sugar, status: "INACTIVE" }, milk], links,
      options.map((o) => (o.group_id === "MG-3" ? { ...o, status: "INACTIVE" } : o)));
    expect(stopped.map((x) => x.group.name)).toEqual(["Thêm Topping"]);
  });
  it("has no default when the default option is stopped", () => {
    const [s] = optionGroupsForProduct("TRA", [sugar], links, options.map((o) => (o.id === "S2" ? { ...o, status: "INACTIVE" } : o)));
    expect(s.defaultId).toBeNull();
  });
});

describe("Chọn một", () => {
  const [s, m] = optionGroupsForProduct("TRA", [sugar, milk], links, options);
  it("lights the default when nothing is picked", () => {
    expect(litOptionId([], s)).toBe("S2");
  });
  it("moves the pick and never stores the default", () => {
    const yen = pickOne([], m, options[5]);
    expect(yen.map((p) => p.id)).toEqual(["K2"]);
    expect(pickOne(yen, m, options[4])).toEqual([]);
  });
  it("clears the pick when the lit option is tapped again", () => {
    const it1 = pickOne([], s, options[0]);
    expect(pickOne(it1, s, options[0])).toEqual([]);
  });
  it("keeps picks of other groups", () => {
    const both = pickOne(pickOne([], s, options[0]), m, options[5]);
    expect(both.map((p) => p.id).sort()).toEqual(["K2", "S1"]);
  });
});

describe("Chọn nhiều caps", () => {
  const [t] = optionGroupsForProduct("CAFE", [topping], links, options);
  const tc = { id: "T1", name: "Trân châu trắng", price: 5000 };
  const km = { id: "T2", name: "Kem muối", price: 4000 };
  it("stops an option at its own cap", () => {
    expect(canAddPortion([tc], t, options[2])).toBe(true);
    expect(canAddPortion([tc, tc], t, options[2])).toBe(false);
  });
  it("stops the group at its total", () => {
    expect(canAddPortion([tc, tc, km], t, options[3])).toBe(false);
  });
  it("has no cap when both are blank", () => {
    const [free] = optionGroupsForProduct("CAFE", [{ ...topping, max_total: null }], links, options);
    expect(canAddPortion(Array(9).fill(km), free, options[3])).toBe(true);
  });
});

describe("orderPicks", () => {
  const sweetG = { group: g({ id: "MG-A", name: "Độ ngọt" }), defaultId: null, options: [opt({ id: "A0", name: "Bình thường" }), opt({ id: "A1", name: "Ít ngọt" }), opt({ id: "A2", name: "Không đường" })] };
  const sauceG = { group: g({ id: "MG-B", name: "Sốt" }), defaultId: null, options: [opt({ id: "B1", name: "Caramel" }), opt({ id: "B2", name: "Kem muối" })] };
  const groups = [sweetG, sauceG];
  const p = (id: string) => ({ id, name: id, price: 0 });

  it("sorts by group, then by option within the group", () => {
    expect(orderPicks([p("B2"), p("A1"), p("B1")], groups).map((x) => x.id)).toEqual(["A1", "B1", "B2"]);
  });
  it("puts unknown picks last, keeping their order", () => {
    expect(orderPicks([p("X2"), p("B1"), p("X1"), p("A1")], groups).map((x) => x.id)).toEqual(["A1", "B1", "X2", "X1"]);
  });
  it("does not mutate the input", () => {
    const input = [p("B2"), p("A1")];
    orderPicks(input, groups);
    expect(input.map((x) => x.id)).toEqual(["B2", "A1"]);
  });
});
