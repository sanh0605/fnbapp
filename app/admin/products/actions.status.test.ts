import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  eraseProductAtomic: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  update: mocks.update,
}));
vi.mock("@/lib/product-erase-transaction", () => ({
  eraseProductAtomic: mocks.eraseProductAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { pauseProduct, resumeProduct, eraseProduct } from "./actions";

function formDataWithId(id: string): FormData {
  const fd = new FormData();
  fd.append("id", id);
  return fd;
}

describe("pauseProduct / resumeProduct -- docs/superpowers/plans/2026-08-29-product-stop-selling-and-real-delete.md section 5.1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
  });

  it("pausing sets INACTIVE on the product and its ACTIVE variants only", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "VAR-A", product_id: "PROD-1", status: "ACTIVE" },
      { id: "VAR-B", product_id: "PROD-1", status: "ACTIVE" },
      { id: "VAR-DELETED", product_id: "PROD-1", status: "DELETED" },
      { id: "VAR-OTHER", product_id: "PROD-2", status: "ACTIVE" },
    ]);

    const res = await pauseProduct(formDataWithId("PROD-1"));

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith("Products", "PROD-1", { status: "INACTIVE" });
    expect(mocks.update).toHaveBeenCalledWith("Product_Variants", "VAR-A", { status: "INACTIVE" });
    expect(mocks.update).toHaveBeenCalledWith("Product_Variants", "VAR-B", { status: "INACTIVE" });
    // A variant already DELETED (individually discontinued before this
    // pause) must not be resurrected into INACTIVE -- it stays DELETED.
    expect(mocks.update).not.toHaveBeenCalledWith("Product_Variants", "VAR-DELETED", expect.anything());
    // A different product's variant must not be touched.
    expect(mocks.update).not.toHaveBeenCalledWith("Product_Variants", "VAR-OTHER", expect.anything());
  });

  // Fixed 2026-08-29 after the owner hit it in production: Test1 (PROD-048)
  // has exactly this shape -- one variant, DELETED, no ACTIVE variant at
  // all. Under the old INACTIVE-only rule, resuming it set the product back
  // to ACTIVE with nothing sellable ("Đang bán" but zero size to add).
  it("resuming a product with no ACTIVE variant at all restores every non-ACTIVE variant, including a DELETED one -- Test1's real shape in production", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "VAR-A", product_id: "PROD-1", status: "INACTIVE" },
      { id: "VAR-DELETED", product_id: "PROD-1", status: "DELETED" },
    ]);

    const res = await resumeProduct(formDataWithId("PROD-1"));

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith("Products", "PROD-1", { status: "ACTIVE" });
    expect(mocks.update).toHaveBeenCalledWith("Product_Variants", "VAR-A", { status: "ACTIVE" });
    // No curated size exists to protect -- there is nothing sellable to
    // leave the product without, so this DELETED size comes back too.
    expect(mocks.update).toHaveBeenCalledWith("Product_Variants", "VAR-DELETED", { status: "ACTIVE" });
  });

  // The mixed case: at least one size already ACTIVE, alongside an
  // INACTIVE one and a DELETED one. Measured live 2026-08-29: 43 products
  // have every variant ACTIVE, 4 have none ACTIVE, 0 are mixed -- so no
  // production data exercises this branch today. It is exactly the branch
  // the asymmetric rule exists to protect (someone curated sizes
  // individually; resuming the product must not resurrect one they
  // deliberately discontinued), so it is tested here regardless.
  it("resuming a product where at least one size is already ACTIVE restores only the INACTIVE ones, leaving a DELETED one untouched (the mixed case, not exercised by any product today)", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "VAR-ACTIVE", product_id: "PROD-1", status: "ACTIVE" },
      { id: "VAR-INACTIVE", product_id: "PROD-1", status: "INACTIVE" },
      { id: "VAR-DELETED", product_id: "PROD-1", status: "DELETED" },
    ]);

    const res = await resumeProduct(formDataWithId("PROD-1"));

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith("Products", "PROD-1", { status: "ACTIVE" });
    expect(mocks.update).toHaveBeenCalledWith("Product_Variants", "VAR-INACTIVE", { status: "ACTIVE" });
    // Already ACTIVE -- no redundant write.
    expect(mocks.update).not.toHaveBeenCalledWith("Product_Variants", "VAR-ACTIVE", expect.anything());
    // A size individually discontinued before this pause/resume cycle must
    // not be resurrected just because a sibling size is already live.
    expect(mocks.update).not.toHaveBeenCalledWith("Product_Variants", "VAR-DELETED", expect.anything());
  });

  it("refuses without admin auth", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Không có quyền" });

    const res = await pauseProduct(formDataWithId("PROD-1"));

    expect(res.error).toBe("Không có quyền");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("eraseProduct -- section 5.3/3, refusal tested with the Test1 fixture shape (1 sale, 1 price history)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
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
  });

  it("refuses without admin auth", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Không có quyền" });

    const res = await eraseProduct(formDataWithId("PROD-037"));

    expect(res.error).toBe("Không có quyền");
    expect(mocks.eraseProductAtomic).not.toHaveBeenCalled();
  });
});
