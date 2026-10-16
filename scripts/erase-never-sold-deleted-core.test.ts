import { describe, it, expect } from "vitest";
import { selectErasures, type Input } from "./erase-never-sold-deleted-core";

const base = (p: Partial<Input> = {}): Input => ({
  products: [
    { id: "PROD-007", name: "Cà phê kem dẻo CT1", status: "DELETED", category_id: "CAT-1" },
    { id: "PROD-008", name: "Cà phê kem dẻo CT2", status: "DELETED", category_id: "CAT-1" },
    { id: "PROD-001", name: "Cà phê sữa đá", status: "ACTIVE", category_id: "CAT-1" },
  ],
  variants: [
    { id: "VAR-007", product_id: "PROD-007", status: "DELETED" },
    { id: "VAR-008", product_id: "PROD-008", status: "DELETED" },
    { id: "VAR-001", product_id: "PROD-001", status: "ACTIVE" },
  ],
  categories: [], modifiers: [],
  soldProductIds: [], soldVariantIds: [], soldModifierIds: [], refs: [],
  ...p,
});

describe("selectErasures", () => {
  it("selects only DELETED dishes that were never sold, with their sizes", () => {
    const r = selectErasures(base({ soldVariantIds: ["VAR-008"] }));
    expect(r.dishes).toEqual([{ id: "PROD-007", name: "Cà phê kem dẻo CT1", variantIds: ["VAR-007"] }]);
    expect(r.skipped).toEqual([{ kind: "món", id: "PROD-008", name: "Cà phê kem dẻo CT2", reason: "đã có đơn" }]);
  });

  it("a reference outside price history keeps the dish; PROD-0071 is not PROD-007", () => {
    const r = selectErasures(base({
      refs: [
        { where: "promotions.applicable_products_json (PRM-001)", value: '["PROD-007"]' },
        { where: "pos_drafts.cart_json (x)", value: '["PROD-0071"]' },
      ],
    }));
    expect(r.dishes.map(d => d.id)).toEqual(["PROD-008"]);
    expect(r.skipped).toEqual([{ kind: "món", id: "PROD-007", name: "Cà phê kem dẻo CT1", reason: "còn được nhắc ở promotions.applicable_products_json (PRM-001)" }]);
  });

  it("a DELETED category goes only when no dish stays in it, counting dishes erased in the same run as gone", () => {
    const cats = [{ id: "CAT-1", name: "Cà phê", status: "DELETED" }, { id: "CAT-2", name: "Cacao", status: "DELETED" }];
    const r = selectErasures(base({
      categories: cats,
      products: [
        { id: "PROD-007", name: "A", status: "DELETED", category_id: "CAT-2" },
        { id: "PROD-001", name: "B", status: "ACTIVE", category_id: "CAT-1" },
      ],
      variants: [],
    }));
    expect(r.categories).toEqual([{ id: "CAT-2", name: "Cacao" }]);
    expect(r.skipped).toContainEqual({ kind: "nhóm", id: "CAT-1", name: "Cà phê", reason: "còn món" });
  });

  it("a DELETED option goes only when the rpc says it was never sold and no snapshot names it", () => {
    const mods = [
      { id: "MOD-1", name: "Dâu sấy", status: "DELETED" },
      { id: "MOD-2", name: "Trân châu", status: "DELETED" },
      { id: "MOD-3", name: "Kem", status: "DELETED" },
      { id: "MOD-4", name: "Sữa", status: "ACTIVE" },
    ];
    const r = selectErasures(base({
      modifiers: mods, soldModifierIds: ["MOD-2"],
      refs: [{ where: "order_events.delta_json (evt-1)", value: '{"modifier_id": "MOD-1"}' }],
    }));
    expect(r.modifiers).toEqual([{ id: "MOD-3", name: "Kem" }]);
    expect(r.skipped).toContainEqual({ kind: "tuỳ chọn", id: "MOD-1", name: "Dâu sấy", reason: "còn được nhắc ở order_events.delta_json (evt-1)" });
    expect(r.skipped).toContainEqual({ kind: "tuỳ chọn", id: "MOD-2", name: "Trân châu", reason: "đã có đơn" });
  });

  it("a DELETED size under a dish that stays is left alone", () => {
    const r = selectErasures(base({ variants: [{ id: "VAR-X", product_id: "PROD-001", status: "DELETED" }] }));
    expect(r.dishes.map(d => d.id)).toEqual(["PROD-007", "PROD-008"]);
    expect(r.skipped.map(s => s.id)).toEqual(["VAR-X"]);
  });
});
