import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireOwner: mocks.requireOwner,
}));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllWhere: mocks.findAllWhere,
  remove: mocks.remove,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getBrands, deleteBrand } from "./actions";

// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getBrands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty list", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getBrands()).rejects.toThrow("db down");
  });

  it("a genuinely empty Brands table still resolves with [] and does not throw", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(getBrands()).resolves.toEqual([]);
  });
});

// Rows that still carry a brand, keyed by table; the mock honours eq.brand_id.
function seed(rows: Record<string, number>, brandId = "BR-001") {
  mocks.findAllWhere.mockImplementation(async (table: string, f: { eq?: { brand_id?: string } }) => {
    if (f?.eq?.brand_id !== brandId) return [];
    return Array.from({ length: rows[table] ?? 0 }, (_, i) => ({ id: `${table}-${i}`, brand_id: brandId }));
  });
}

function form(id: string) {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

describe("deleteBrand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockResolvedValue([
      { id: "BR-001", name: "Phin Đi" },
      { id: "BR-002", name: "Uchako" },
      { id: "BR-003", name: "Quán mới" },
    ]);
    mocks.remove.mockResolvedValue(undefined);
  });

  it("refuses Phin Đi naming outlets and orders, with thousands separators", async () => {
    seed({ Outlets: 1, Orders_V2: 2357 });

    const res = await deleteBrand(form("BR-001"));

    expect(res).toEqual({ error: 'Không xoá được thương hiệu "Phin Đi": còn 1 điểm bán, 2.357 đơn hàng.' });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("refuses Uchako naming outlet, promotion and orders, skipping zero counts", async () => {
    seed({ Outlets: 1, Promotions: 1, Orders_V2: 883 }, "BR-002");

    const res = await deleteBrand(form("BR-002"));

    expect(res).toEqual({ error: 'Không xoá được thương hiệu "Uchako": còn 1 điểm bán, 1 khuyến mãi, 883 đơn hàng.' });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("names dishes between promotions and orders", async () => {
    seed({ Products: 3, Orders_V2: 2 });

    const res = await deleteBrand(form("BR-001"));

    expect(res).toEqual({ error: 'Không xoá được thương hiệu "Phin Đi": còn 3 món, 2 đơn hàng.' });
  });

  it("deletes a brand nothing uses", async () => {
    seed({}, "BR-003");

    const res = await deleteBrand(form("BR-003"));

    expect(res).toEqual({ success: true });
    expect(mocks.remove).toHaveBeenCalledWith("Brands", "BR-003");
  });

  it("still refuses a non-ADMIN by role, before reading anything", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" });

    const res = await deleteBrand(form("BR-003"));

    expect(res).toEqual({ error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" });
    expect(mocks.findAllWhere).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
