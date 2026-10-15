import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: vi.fn() }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findById: vi.fn(),
  insert: mocks.insert,
  generateNewId: mocks.generateNewId,
  getCacheTag: (t: string) => `sheets-${t}`,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { addPurchaseSource } from "./actions";

describe("addPurchaseSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "a", name: "A" } });
    mocks.findAll.mockResolvedValue([{ id: "SRC-002", name: "Shopee", status: "ACTIVE" }]);
    mocks.generateNewId.mockResolvedValue("SRC-004");
  });

  it("refuses a blank name", async () => {
    const res = await addPurchaseSource("   ");
    expect(res.error).toBe("Vui lòng nhập tên nguồn");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns the existing source for the same name ignoring case and spaces, inserting nothing", async () => {
    const res = await addPurchaseSource("  shopee ");
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: "SRC-002", name: "Shopee" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("inserts a new source with the trimmed name and returns { id, name }", async () => {
    const res = await addPurchaseSource("  Tiktok Shop ");
    expect(mocks.insert).toHaveBeenCalledWith("Purchase_Sources", expect.objectContaining({ id: "SRC-004", name: "Tiktok Shop" }));
    expect(res.data).toEqual({ id: "SRC-004", name: "Tiktok Shop" });
  });
});
