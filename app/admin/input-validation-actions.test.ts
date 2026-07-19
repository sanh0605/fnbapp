import { beforeEach, describe, expect, it, vi } from "vitest";

const findAllMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const removeMock = vi.hoisted(() => vi.fn());
const generateNewIdMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sheets_db", () => ({
  findAll: findAllMock,
  insert: insertMock,
  update: updateMock,
  remove: removeMock,
  generateNewId: generateNewIdMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: requireAdminMock }));

import { addSupplier } from "./suppliers/actions";
import { addConversion } from "./inventory/conversions/actions";
import { savePromotion } from "./promotions/actions";

describe("Gate 7 admin input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
    findAllMock.mockResolvedValue([]);
    generateNewIdMock.mockResolvedValue("NEW-1");
  });

  it("rejects whitespace-only and overlong supplier names before any write", async () => {
    for (const name of ["   ", "n".repeat(121)]) {
      const formData = new FormData();
      formData.set("name", name);

      const result = await addSupplier(formData);

      expect(result.error).toBeTruthy();
    }
    expect(findAllMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("trims bounded supplier fields before storing them", async () => {
    const formData = new FormData();
    formData.set("name", "  Nhà cung cấp A  ");
    formData.set("phone", " 0901234567 ");
    formData.set("tax_id", " TAX-1 ");
    formData.set("address", " 123 Đường A ");
    formData.set("links", " https://example.test ");

    const result = await addSupplier(formData);

    expect(result.success).toBe(true);
    expect(insertMock).toHaveBeenCalledWith("Suppliers", expect.objectContaining({
      name: "Nhà cung cấp A",
      phone: "0901234567",
      tax_id: "TAX-1",
      address: "123 Đường A",
      links: "https://example.test",
    }));
  });

  it("rejects non-positive or non-finite conversion rates before any write", async () => {
    for (const rate of ["0", "-1", "Infinity", "not-a-number"]) {
      const formData = new FormData();
      formData.set("purchased_item_id", "ITEM-1");
      formData.set("purchased_unit", "Thùng");
      formData.set("conversion_rate", rate);
      formData.set("base_unit", "Lon");

      const result = await addConversion(formData);

      expect(result.error).toMatch(/lớn hơn 0/i);
    }
    expect(generateNewIdMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("enforces promotion invariants when the server action is called directly", async () => {
    const validBase = {
      name: "Promo",
      code: "PROMO",
      brand_id: "",
      type: "ORDER_DISCOUNT",
      discount_type: "FLAT_VND",
      discount_value: 10,
      min_order_value: 0,
      start_date: "2026-07-19T00:00:00Z",
      end_date: "2026-07-20T00:00:00Z",
      applicable_products_json: "",
      status: "ACTIVE",
    };
    const invalidPayloads = [
      { ...validBase, name: "   " },
      { ...validBase, discount_type: "PERCENT", discount_value: 101 },
      { ...validBase, min_order_value: -1 },
      { ...validBase, start_date: "invalid" },
      { ...validBase, type: "PRODUCT_DISCOUNT", applicable_products_json: "{}" },
    ];

    for (const payload of invalidPayloads) {
      const result = await savePromotion(payload);
      expect(result.error).toBeTruthy();
    }
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("normalizes a valid promotion before storing it", async () => {
    const result = await savePromotion({
      name: "  Happy Hour  ",
      code: " happy10 ",
      brand_id: "",
      type: "ORDER_DISCOUNT",
      discount_type: "PERCENT",
      discount_value: "10",
      min_order_value: "50000",
      start_date: "2026-07-19T00:00:00Z",
      end_date: "2026-07-20T00:00:00Z",
      applicable_products_json: "",
      status: "ACTIVE",
    });

    expect(result).toMatchObject({ success: true, id: "NEW-1" });
    expect(insertMock).toHaveBeenCalledWith("Promotions", expect.objectContaining({
      id: "NEW-1",
      name: "Happy Hour",
      code: "HAPPY10",
      discount_value: 10,
      min_order_value: 50_000,
      start_date: "2026-07-19T00:00:00.000Z",
      end_date: "2026-07-20T00:00:00.000Z",
    }));
  });
});
