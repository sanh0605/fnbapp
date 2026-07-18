import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  update: mocks.update,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveProduct } from "./actions";

type Row = Record<string, unknown>;

describe("saveProduct forced failures", () => {
  let tables: Record<string, Row[]>;
  let idCounters: Record<string, number>;
  let failOnceAt: string | null;

  beforeEach(() => {
    vi.clearAllMocks();
    tables = {
      Products: [],
      Product_Variants: [],
      Product_Price_History: [],
      Recipes: [],
    };
    idCounters = {};
    failOnceAt = null;

    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.findAll.mockImplementation(async (sheet: string) => cloneRows(tableFor(sheet)));
    mocks.generateNewId.mockImplementation(async (sheet: string, prefix: string) => {
      idCounters[sheet] = (idCounters[sheet] || 0) + 1;
      return `${prefix}-${idCounters[sheet]}`;
    });
    mocks.insert.mockImplementation(async (sheet: string, row: Row) => {
      const operation = `insert:${sheet}`;
      if (failOnceAt === operation) {
        failOnceAt = null;
        throw new Error(`${operation} failed`);
      }
      tableFor(sheet).push({ ...row });
    });
    mocks.update.mockImplementation(async (sheet: string, id: string, patch: Row) => {
      const operation = `update:${sheet}`;
      if (failOnceAt === `${operation}:${id}` || failOnceAt === operation) {
        failOnceAt = null;
        throw new Error(`${operation} failed`);
      }
      const row = tableFor(sheet).find(value => value.id === id);
      if (row) Object.assign(row, patch);
    });
  });

  it("leaves no rows when product insert fails, then retry creates one complete product", async () => {
    failOnceAt = "insert:Products";

    const failed = await saveProduct(makeCreateFormData());
    expect(failed).toEqual({ error: "insert:Products failed" });
    expect(tableCounts()).toEqual([0, 0, 0, 0]);

    const retry = await saveProduct(makeCreateFormData());
    expect(retry.success).toBe(true);
    expect(tableCounts()).toEqual([1, 1, 1, 1]);
  });

  it("leaves an orphan product when variant insert fails, then retry creates a second product", async () => {
    failOnceAt = "insert:Product_Variants";

    const failed = await saveProduct(makeCreateFormData());
    expect(failed).toEqual({ error: "insert:Product_Variants failed" });
    expect(tableCounts()).toEqual([1, 0, 0, 0]);

    const retry = await saveProduct(makeCreateFormData());
    expect(retry.success).toBe(true);
    expect(tableCounts()).toEqual([2, 1, 1, 1]);
    expect(tables.Products.map(row => row.id)).toEqual(["PROD-1", "PROD-2"]);
    expect(tables.Product_Variants[0].product_id).toBe("PROD-2");
  });

  it("leaves product and variant rows when price history insert fails, then retry duplicates the catalog header", async () => {
    failOnceAt = "insert:Product_Price_History";

    const failed = await saveProduct(makeCreateFormData());
    expect(failed).toEqual({ error: "insert:Product_Price_History failed" });
    expect(tableCounts()).toEqual([1, 1, 0, 0]);

    const retry = await saveProduct(makeCreateFormData());
    expect(retry.success).toBe(true);
    expect(tableCounts()).toEqual([2, 2, 1, 1]);
    expect(tables.Product_Variants.map(row => row.product_id)).toEqual(["PROD-1", "PROD-2"]);
  });

  it("leaves product, variant, and price history rows when recipe insert fails, then retry duplicates them", async () => {
    failOnceAt = "insert:Recipes";

    const failed = await saveProduct(makeCreateFormData());
    expect(failed).toEqual({ error: "insert:Recipes failed" });

    const retry = await saveProduct(makeCreateFormData());
    expect(retry.success).toBe(true);

    expect(tableCounts()).toEqual([2, 2, 2, 1]);
    expect(tables.Recipes[0].target_id).toBe("VAR-2");
  });

  it("loses the price-history event when edit updates the variant price before history insert fails", async () => {
    seedExistingProduct();
    failOnceAt = "insert:Product_Price_History";

    const failed = await saveProduct(makeEditFormData({ price: 30_000 }));
    expect(failed).toEqual({ error: "insert:Product_Price_History failed" });
    expect(tables.Product_Variants[0].price).toBe(30_000);
    expect(tables.Product_Price_History).toHaveLength(0);

    const retry = await saveProduct(makeEditFormData({ price: 30_000 }));
    expect(retry.success).toBe(true);
    expect(tables.Product_Variants[0].price).toBe(30_000);
    expect(tables.Product_Price_History).toHaveLength(0);
  });

  it("temporarily leaves no active recipe when recipe version insert fails, then retry repairs the gap", async () => {
    seedExistingProduct();
    failOnceAt = "insert:Recipes";

    const failed = await saveProduct(makeEditFormData({ ingredientId: "ING-002" }));
    expect(failed).toEqual({ error: "insert:Recipes failed" });
    expect(tables.Recipes).toHaveLength(1);
    expect(tables.Recipes[0].end_date).not.toBeNull();

    const retry = await saveProduct(makeEditFormData({ ingredientId: "ING-002" }));
    expect(retry.success).toBe(true);
    expect(tables.Recipes).toHaveLength(2);
    expect(tables.Recipes.filter(row => row.end_date == null)).toHaveLength(1);
  });

  it("keeps a removed variant active when soft-delete fails, then retry completes the deletion", async () => {
    seedExistingProduct(true);
    failOnceAt = "update:Product_Variants:VAR-REMOVED";

    const failed = await saveProduct(makeEditFormData());
    expect(failed).toEqual({ error: "update:Product_Variants failed" });
    expect(tables.Product_Variants.find(row => row.id === "VAR-REMOVED")?.status).toBe("ACTIVE");

    const retry = await saveProduct(makeEditFormData());
    expect(retry.success).toBe(true);
    expect(tables.Product_Variants.find(row => row.id === "VAR-REMOVED")?.status).toBe("DELETED");
  });

  function tableCounts(): number[] {
    return [
      tables.Products.length,
      tables.Product_Variants.length,
      tables.Product_Price_History.length,
      tables.Recipes.length,
    ];
  }

  function seedExistingProduct(withRemovedVariant = false): void {
    tables.Products.push({
      id: "PROD-EXISTING",
      category_id: "CAT-001",
      name: "Existing product",
      status: "ACTIVE",
    });
    tables.Product_Variants.push({
      id: "VAR-EXISTING",
      product_id: "PROD-EXISTING",
      size_name: "M",
      price: 25_000,
      status: "ACTIVE",
    });
    if (withRemovedVariant) {
      tables.Product_Variants.push({
        id: "VAR-REMOVED",
        product_id: "PROD-EXISTING",
        size_name: "L",
        price: 35_000,
        status: "ACTIVE",
      });
    }
    tables.Recipes.push({
      id: "REC-EXISTING",
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-EXISTING",
      ingredients_json: JSON.stringify([makeIngredient("ING-001")]),
      created_at: "2026-07-01T00:00:00.000Z",
      end_date: null,
    });
  }

  function tableFor(sheet: string): Row[] {
    const table = tables[sheet];
    if (!table) throw new Error(`Unexpected sheet ${sheet}`);
    return table;
  }
});

function makeCreateFormData(): FormData {
  const formData = new FormData();
  formData.set("category_id", "CAT-001");
  formData.set("name", "Món thử lỗi");
  formData.set("variants_json", JSON.stringify([{
    id: "",
    size_name: "M",
    price: 30_000,
    ingredients: [makeIngredient("ING-001")],
  }]));
  formData.set("effective_date", "2026-07-19T00:00:00.000Z");
  return formData;
}

function makeEditFormData(options: { price?: number; ingredientId?: string } = {}): FormData {
  const formData = new FormData();
  formData.set("id", "PROD-EXISTING");
  formData.set("category_id", "CAT-001");
  formData.set("name", "Existing product updated");
  formData.set("variants_json", JSON.stringify([{
    id: "VAR-EXISTING",
    size_name: "M",
    price: options.price ?? 25_000,
    ingredients: [makeIngredient(options.ingredientId ?? "ING-001")],
  }]));
  formData.set("effective_date", "2026-07-19T00:00:00.000Z");
  return formData;
}

function makeIngredient(ingredientId: string): Row {
  return {
    ingredient_type: "BASE_INGREDIENT",
    ingredient_id: ingredientId,
    quantity: 10,
    unit_id: "UNT-001",
  };
}

function cloneRows(rows: Row[]): Row[] {
  return rows.map(row => ({ ...row }));
}
