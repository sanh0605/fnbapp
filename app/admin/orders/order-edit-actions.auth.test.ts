import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findById: vi.fn(),
  findAllWhere: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findById: mocks.findById,
  findAllWhere: mocks.findAllWhere,
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { editOrderV2 } from "./order-edit-actions";

describe("editOrderV2 authorisation order (E12)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses an unauthorised caller before reading any order data", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });
    const result = await editOrderV2({ orderId: "ord-1", reason: "x" } as any);
    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.findAllWhere).not.toHaveBeenCalled();
  });
});
