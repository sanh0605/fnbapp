import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-10-14 audit, wave 1: F2 (edit keeps the stored picture), F3 (never-sold
// dish linked as a topping cannot be erased, with the real reason), F6 (a
// linked topping cannot get a second size).

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  saveProductAtomic: vi.fn(),
  eraseProductAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({ findAll: mocks.findAll, update: mocks.update }));
vi.mock("@/lib/products/product-save-transaction", () => ({ saveProductAtomic: mocks.saveProductAtomic }));
vi.mock("@/lib/products/product-erase-transaction", () => ({ eraseProductAtomic: mocks.eraseProductAtomic }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { saveProduct, eraseProduct } from "./actions";

const TABLES: Record<string, any[]> = {};

function editForm(variants: unknown[], extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("id", "PROD-1");
  fd.append("category_id", "CAT-001");
  fd.append("name", "Trà đào");
  fd.append("variants_json", JSON.stringify(variants));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}

function idForm(id: string): FormData {
  const fd = new FormData();
  fd.append("id", id);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "a", name: "Admin", role: "ADMIN" } });
  mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "a", name: "Admin", role: "ADMIN" } });
  for (const k of Object.keys(TABLES)) delete TABLES[k];
  TABLES.Products = [{ id: "PROD-1", name: "Trà đào", status: "ACTIVE", image_url: "https://img/tra-dao.jpg" }];
  TABLES.Product_Variants = [{ id: "VAR-1", product_id: "PROD-1", size_name: "M", price: 30000, status: "ACTIVE" }];
  TABLES.Modifiers = [];
  mocks.findAll.mockImplementation(async (sheet: string) => TABLES[sheet] ?? []);
  mocks.saveProductAtomic.mockImplementation(async (input: any) => ({
    productId: "PROD-1",
    variantCount: input.variants.length,
    priceHistoryCount: input.expectedPriceHistoryCount,
    removedVariantCount: input.removedVariantIds.length,
  }));
});

describe("F2 saveProduct keeps the stored picture", () => {
  it("edit with no picture in the form sends the stored image_url, not an empty one", async () => {
    const res = await saveProduct(editForm([{ id: "VAR-1", size_name: "M", price: 30000 }]));
    expect(res.error).toBeUndefined();
    expect(mocks.saveProductAtomic.mock.calls[0][0].product.image_url).toBe("https://img/tra-dao.jpg");
  });

  it("a picture sent by the form wins over the stored one", async () => {
    await saveProduct(editForm([{ id: "VAR-1", size_name: "M", price: 30000 }], { image_url: "https://img/new.jpg" }));
    expect(mocks.saveProductAtomic.mock.calls[0][0].product.image_url).toBe("https://img/new.jpg");
  });

  it("a new dish still gets an empty picture", async () => {
    const fd = new FormData();
    fd.append("category_id", "CAT-001");
    fd.append("name", "Món mới");
    fd.append("variants_json", JSON.stringify([{ size_name: "M", price: 1000 }]));
    await saveProduct(fd);
    expect(mocks.saveProductAtomic.mock.calls[0][0].product.image_url).toBe("");
  });
});

describe("F6 a linked topping cannot get a second size", () => {
  const withNewSize = [
    { id: "VAR-1", size_name: "M", price: 30000 },
    { size_name: "L", price: 35000 },
  ];

  it("refuses a new size on a dish linked to an ACTIVE topping, naming the reason", async () => {
    TABLES.Modifiers = [{ id: "MOD-1", name: "Trà đào", status: "ACTIVE", product_id: "PROD-1" }];
    const res = await saveProduct(editForm(withNewSize));
    expect(res.error).toContain("topping");
    expect(res.error).toContain("một size");
    expect(mocks.saveProductAtomic).not.toHaveBeenCalled();
  });

  it("still allows editing the one existing size of a linked topping", async () => {
    TABLES.Modifiers = [{ id: "MOD-1", name: "Trà đào", status: "ACTIVE", product_id: "PROD-1" }];
    const res = await saveProduct(editForm([{ id: "VAR-1", size_name: "M", price: 30000 }]));
    expect(res.error).toBeUndefined();
    expect(mocks.saveProductAtomic).toHaveBeenCalledTimes(1);
  });

  it("allows a new size when the only linked topping is DELETED", async () => {
    TABLES.Modifiers = [{ id: "MOD-7", name: "Trà đào", status: "DELETED", product_id: "PROD-1" }];
    const res = await saveProduct(editForm(withNewSize));
    expect(res.error).toBeUndefined();
  });
});

describe("F3 erasing a dish linked as a topping", () => {
  it("refuses before the database does, saying the real reason", async () => {
    TABLES.Modifiers = [{ id: "MOD-1", name: "Trân châu", status: "ACTIVE", product_id: "PROD-1" }];
    const res = await eraseProduct(idForm("PROD-1"));
    expect(res.error).toContain("topping");
    expect(res.error).toContain("Trân châu");
    expect(res.error).not.toContain("đã có đơn hàng");
    expect(mocks.eraseProductAtomic).not.toHaveBeenCalled();
  });

  it("a DELETED topping still points at the dish, so it also blocks the erase", async () => {
    TABLES.Modifiers = [{ id: "MOD-7", name: "Trân châu cũ", status: "DELETED", product_id: "PROD-1" }];
    const res = await eraseProduct(idForm("PROD-1"));
    expect(res.error).toContain("Trân châu cũ");
    expect(mocks.eraseProductAtomic).not.toHaveBeenCalled();
  });

  it("an unlinked never-sold dish is still erased", async () => {
    mocks.eraseProductAtomic.mockResolvedValue({ productId: "PROD-1", productName: "Trà đào", priceHistoryDeleted: 0, variantsDeleted: 1 });
    const res = await eraseProduct(idForm("PROD-1"));
    expect(res.error).toBeUndefined();
    expect(mocks.eraseProductAtomic).toHaveBeenCalledWith("PROD-1");
  });
});

describe("Nhóm tuỳ chọn ticks on the dish form", () => {
  const sizes = [{ id: "VAR-1", size_name: "M", price: 30000 }];

  it("passes the ticked groups to the atomic save and refreshes the links cache", async () => {
    const fd = editForm(sizes, { option_group_ids_sent: "1" });
    fd.append("option_group_ids", "MG-001");
    fd.append("option_group_ids", "MG-002");
    await saveProduct(fd);
    expect(mocks.saveProductAtomic.mock.calls[0][0].optionGroupIds).toEqual(["MG-001", "MG-002"]);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifier_Group_Products");
  });

  it("sends an empty list when the tick list was shown and every group is unticked", async () => {
    await saveProduct(editForm(sizes, { option_group_ids_sent: "1" }));
    expect(mocks.saveProductAtomic.mock.calls[0][0].optionGroupIds).toEqual([]);
  });

  it("leaves the ticks alone when the form never showed the tick list", async () => {
    await saveProduct(editForm(sizes));
    expect(mocks.saveProductAtomic.mock.calls[0][0].optionGroupIds).toBeUndefined();
  });
});

describe("price history takes the save time", () => {
  it("ignores an effective_date sent by an old open form", async () => {
    const before = Date.now();
    await saveProduct(editForm([{ id: "VAR-1", size_name: "M", price: 30000 }], { effective_date: "2020-01-01T00:00:00.000Z" }));
    const at = Date.parse(mocks.saveProductAtomic.mock.calls[0][0].effectiveAt);
    expect(at).toBeGreaterThanOrEqual(before);
  });
});
