import { describe, it, expect, vi } from "vitest";

const db = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  lineReads: 0,
  idScans: 0,
}));

vi.mock("@/lib/auth/auth", () => ({ resolveActor: vi.fn().mockResolvedValue({ ok: false }) }));
vi.mock("@/lib/db/tables", () => {
  const match = (row: any, f: any) =>
    Object.entries(f.eq ?? {}).every(([k, v]) => row[k] === v) &&
    Object.entries(f.in ?? {}).every(([k, vs]) => (vs as any[]).includes(row[k]));
  const findAllWhere = async (name: string, f: any) => {
    if (name === "Order_Lines_V2") db.lineReads++;
    const rows = db.tables[name].filter(r => match(r, f));
    return f.limit ? rows.slice(0, f.limit) : rows;
  };
  return {
    findAll: async (name: string) => db.tables[name],
    findAllWhere,
    findAllWhereInBatches: async (name: string, col: string, vs: any[]) =>
      findAllWhere(name, { in: { [col]: vs } }),
    findSoldModifierIds: async () => {
      db.idScans++;
      return db.tables["__soldModifiers"].map(m => m);
    },
  };
});

import { loadProductRows, loadProductRow } from "./load-product-rows";

describe("loadProductRow equals loadProductRows for the same dish (F12)", () => {
  db.tables = {
    Product_Categories: [{ id: "CAT-1", name: "Cà phê", status: "ACTIVE" }],
    Products: [
      { id: "P1", name: "Cà phê sữa", category_id: "CAT-1", status: "ACTIVE" },
      { id: "P2", name: "Chưa bán", category_id: "CAT-1", status: "ACTIVE" },
      { id: "P3", name: "Trân châu", category_id: "CAT-1", status: "ACTIVE" },
      { id: "P4", name: "Sữa đậu", category_id: "CAT-1", status: "INACTIVE" },
      { id: "P5", name: "Đã xoá", category_id: "CAT-1", status: "DELETED" },
    ],
    Product_Variants: [
      { id: "V1", product_id: "P1", status: "ACTIVE" },
      { id: "V1b", product_id: "P1", status: "DELETED" },
      { id: "V1c", product_id: "P1", status: "ACTIVE" },
      { id: "V4", product_id: "P4", status: "INACTIVE" },
    ],
    Product_Price_History: [
      { id: "H1", variant_id: "V1", created_at: "2026-01-01T00:00:00Z", price: 30000 },
      { id: "H2", variant_id: "V1c", created_at: "2026-03-01T00:00:00Z", price: 35000 },
      { id: "H3", variant_id: "V1", created_at: "2026-02-01T00:00:00Z", price: 32000 },
      { id: "H4", variant_id: "V1b", created_at: "2026-02-01T00:00:00Z", price: 1 },
    ],
    Modifiers: [{ id: "M1", product_id: "P3", status: "ACTIVE" }, { id: "M2", product_id: null, status: "ACTIVE" }],
    Order_Lines_V2: [{ id: "L1", product_id: "P1", variant_id: "V1" }, { id: "L2", product_id: null, variant_id: "V4" }],
    __soldModifiers: ["M1"] as any[],
  };

  // The list skips what only the detail page reads.
  const LIST_SKIPS = ["priceHistory", "neverSold", "hasModifierLink"];
  for (const id of ["P1", "P2", "P3", "P4", "P5"]) {
    it(`list row for ${id} is the single row without the detail-only fields`, async () => {
      const bulk = (await loadProductRows()).enhancedProducts.find((p: any) => p.id === id);
      const one: any = await loadProductRow(id);
      for (const k of LIST_SKIPS) delete one[k];
      expect(bulk).toEqual(one);
      for (const k of LIST_SKIPS) expect(bulk).not.toHaveProperty(k);
    });
  }

  // BR-CATALOG-003: P3 sold only as an add-on (M1) counts as sold.
  it("loadProductRow marks never-sold from order lines and from add-on sales", async () => {
    expect(((await loadProductRow("P1")) as any).neverSold).toBe(false);
    expect(((await loadProductRow("P2")) as any).neverSold).toBe(true);
    expect(((await loadProductRow("P3")) as any).neverSold).toBe(false);
  });

  it("the list reads no price history and scans no order lines", async () => {
    db.idScans = 0;
    await loadProductRows();
    expect(db.idScans).toBe(0);
  });

  it("returns null for an unknown id and probes order lines with limit-1 reads only", async () => {
    expect(await loadProductRow("NOPE")).toBeNull();
    db.idScans = 0;
    await loadProductRow("P1");
    expect(db.idScans).toBe(0);
  });
});
