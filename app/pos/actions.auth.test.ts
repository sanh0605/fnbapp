import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveActor: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getPosInventoryState: vi.fn(),
  savePosOrderAtomic: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  resolveActor: mocks.resolveActor,
  authOptions: {},
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
}));
vi.mock("@/lib/pos-inventory-state", () => ({
  getPosInventoryState: mocks.getPosInventoryState,
}));
vi.mock("@/lib/pos-order-transaction", () => ({
  savePosOrderAtomic: mocks.savePosOrderAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  deletePOSDraft,
  getPOSDrafts,
  savePOSDraft,
  submitOrderV2,
} from "./actions";

const unauthenticated = { ok: false as const, error: "Yêu cầu đăng nhập" };

describe("POS action authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue(unauthenticated);
  });

  it("rejects unauthenticated checkout before any read or write", async () => {
    const result = await submitOrderV2({
      brand_id: "BR-001",
      items: [{ product_id: "PROD-001", quantity: 1 }],
    } as never);

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.getPosInventoryState).not.toHaveBeenCalled();
    expect(mocks.savePosOrderAtomic).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated draft reads before reading storage", async () => {
    await expect(getPOSDrafts("BR-001")).rejects.toThrow("Yêu cầu đăng nhập");

    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated draft saves before any read or write", async () => {
    const result = await savePOSDraft({
      name: "Ca sáng",
      cart_json: "[]",
      brand_id: "BR-001",
    });

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated draft deletion before storage mutation", async () => {
    const result = await deletePOSDraft("DRF-001");

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("preserves the trusted CLI SYSTEM actor when saving a draft", async () => {
    mocks.resolveActor.mockResolvedValue({
      ok: true,
      actor: { id: "system", name: "Hệ thống", role: "SYSTEM" },
    });
    mocks.insert.mockResolvedValue(undefined);

    const result = await savePOSDraft({
      name: "Nhập bằng script",
      cart_json: "[]",
      brand_id: "BR-001",
    });

    expect(result.success).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(
      "POS_Drafts",
      expect.objectContaining({
        created_by_id: "system",
        created_by_name: "Hệ thống",
      }),
    );
  });
});
