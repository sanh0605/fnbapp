import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  eraseProductAtomic: vi.fn(),
  setProductStatusAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findById: mocks.findById,
  update: mocks.update,
}));
vi.mock("@/lib/products/product-erase-transaction", () => ({
  eraseProductAtomic: mocks.eraseProductAtomic,
}));
vi.mock("@/lib/products/product-status-transaction", () => ({
  setProductStatusAtomic: mocks.setProductStatusAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { pauseProduct, resumeProduct, eraseProduct } from "./actions";

function formDataWithId(id: string): FormData {
  const fd = new FormData();
  fd.append("id", id);
  return fd;
}

// 2026-10-14 audit F7: both writes now happen in one Postgres function
// (migration 0114, pinned in tests/migrations/product-status-migration.test.ts,
// which also carries the size-cascade rules these tests used to check one
// update() call at a time). Here: the action calls it once and revalidates.
describe("pauseProduct / resumeProduct -- one atomic call", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.setProductStatusAtomic.mockResolvedValue({ productId: "PROD-1", variantsChanged: 2 });
    mocks.findById.mockResolvedValue({ id: "PROD-1", status: "ACTIVE" });
  });

  // A deleted dish must stay deleted: the RPC would flip it (and its sizes) back on.
  it.each([
    ["resume", resumeProduct],
    ["pause", pauseProduct],
  ])("%s on a deleted dish is refused and never reaches the RPC", async (_name, action) => {
    mocks.findById.mockResolvedValue({ id: "PROD-1", status: "DELETED" });

    const res = await action(formDataWithId("PROD-1"));

    expect(res.error).toBe("Món đã xoá, không bán lại hay ngừng bán được");
    expect(mocks.setProductStatusAtomic).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("pausing makes one call and no separate row writes", async () => {
    const res = await pauseProduct(formDataWithId("PROD-1"));

    expect(res.error).toBeUndefined();
    expect(mocks.setProductStatusAtomic).toHaveBeenCalledTimes(1);
    expect(mocks.setProductStatusAtomic).toHaveBeenCalledWith("PROD-1", "INACTIVE");
    expect(mocks.update).not.toHaveBeenCalled();
    // POS reads these two tables through a cache tag, not this screen's path.
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Products");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Product_Variants");
  });

  it("resuming makes one call and no separate row writes", async () => {
    const res = await resumeProduct(formDataWithId("PROD-1"));

    expect(res.error).toBeUndefined();
    expect(mocks.setProductStatusAtomic).toHaveBeenCalledWith("PROD-1", "ACTIVE");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Products");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Product_Variants");
  });

  it("a failed call reports the error and does not pretend to succeed", async () => {
    mocks.setProductStatusAtomic.mockRejectedValue(new Error("Không tìm thấy món"));

    const res = await pauseProduct(formDataWithId("PROD-1"));

    expect(res.error).toBe("Không tìm thấy món");
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses without admin auth", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Không có quyền" });

    const res = await pauseProduct(formDataWithId("PROD-1"));

    expect(res.error).toBe("Không có quyền");
    expect(mocks.setProductStatusAtomic).not.toHaveBeenCalled();
  });
});

describe("eraseProduct -- section 5.3/3, refusal tested with the Test1 fixture shape (1 sale, 1 price history)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // I2 (final-fix-brief.md, BR-ACCESS-003): eraseProduct is a permanent
    // delete -- requireOwner(), not requireAdmin() (MANAGER could erase a
    // product before this fix).
    mocks.requireOwner.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.findAll.mockResolvedValue([]);
  });

  it("erases a never-sold product", async () => {
    mocks.eraseProductAtomic.mockResolvedValue({
      productId: "PROD-037",
      productName: "Cà phê caramel kem muối",
      priceHistoryDeleted: 0,
      variantsDeleted: 1,
    });

    const res = await eraseProduct(formDataWithId("PROD-037"));

    expect(res.error).toBeUndefined();
    expect(mocks.eraseProductAtomic).toHaveBeenCalledWith("PROD-037");
    expect(mocks.revalidatePath).toHaveBeenCalled();
    // section 3:
    // the fourth and last of the four actions -- same fix, same reason.
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Products");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Product_Variants");
  });

  // "A delete path whose refusal nobody tested is a delete path that will
  // one day not refuse" -- the plan's own section 6. Test1 (PROD-048) is
  // production's real fixture for this shape: 1 variant, 1 price-history
  // row, 1 real sale (measured live 2026-08-29 while critiquing the plan).
  it("refuses to erase a product that has been sold, surfacing the RPC's Vietnamese message verbatim", async () => {
    mocks.eraseProductAtomic.mockRejectedValue(
      new Error('Món "Test1" đã có đơn hàng nên không thể xoá vĩnh viễn. Dùng "Ngừng bán" để ẩn khỏi POS thay vì xoá.'),
    );

    const res = await eraseProduct(formDataWithId("PROD-048"));

    expect(res.success).toBeUndefined();
    expect(res.error).toContain("Test1");
    expect(res.error).toContain("đã có đơn hàng");
    expect(res.error).toContain("Ngừng bán");
    // The refusal must not silently look like success.
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses without owner auth", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Không có quyền" });

    const res = await eraseProduct(formDataWithId("PROD-037"));

    expect(res.error).toBe("Không có quyền");
    expect(mocks.eraseProductAtomic).not.toHaveBeenCalled();
  });
});
