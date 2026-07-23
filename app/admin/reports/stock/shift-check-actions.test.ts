import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveActor: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  openShiftStockCheckAtomic: vi.fn(),
  closeShiftStockCheckAtomic: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ resolveActor: mocks.resolveActor }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllWhere: mocks.findAllWhere,
}));
vi.mock("@/lib/shift-stock-check-transaction", () => ({
  openShiftStockCheckAtomic: mocks.openShiftStockCheckAtomic,
  closeShiftStockCheckAtomic: mocks.closeShiftStockCheckAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  getCheckedItems,
  getActiveShiftStockCheck,
  openShiftStockCheck,
  closeShiftStockCheck,
} from "./shift-check-actions";

const unauthenticated = { ok: false as const, error: "Yêu cầu đăng nhập" };
const authenticated = { ok: true as const, actor: { id: "u1", name: "Chủ quán", role: "ADMIN" as const } };

describe("getCheckedItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves configured names to real items and skips names with no match yet", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Semi_Products") return [{ id: "BTP-013", name: "Trứng luộc", base_unit: "U-009" }];
      if (sheet === "Base_Ingredients") return [{ id: "NNL-007", name: "Trứng gà", base_unit: "U-009" }];
      if (sheet === "Units") return [{ id: "U-009", name: "trái" }];
      return [];
    });

    const result = await getCheckedItems();

    // "Khoai lang" doesn't exist yet -- silently skipped, not an error.
    expect(result).toEqual([{ itemReference: "BTP-013", name: "Trứng luộc", unitName: "trái" }]);
  });

  it("picks up a newly created item once it exists, with no code change", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Semi_Products") return [{ id: "BTP-013", name: "Trứng luộc", base_unit: "U-009" }];
      if (sheet === "Base_Ingredients") return [{ id: "NNL-012", name: "Khoai lang", base_unit: "U-009" }];
      if (sheet === "Units") return [{ id: "U-009", name: "trái" }];
      return [];
    });

    const result = await getCheckedItems();

    expect(result.map((r) => r.itemReference)).toEqual(["BTP-013", "NNL-012"]);
  });
});

describe("getActiveShiftStockCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue(authenticated);
  });

  it("rejects unauthenticated reads before any storage access", async () => {
    mocks.resolveActor.mockResolvedValue(unauthenticated);

    await expect(getActiveShiftStockCheck()).rejects.toThrow("Yêu cầu đăng nhập");
    expect(mocks.findAllWhere).not.toHaveBeenCalled();
  });

  it("returns null when no shift is open", async () => {
    mocks.findAllWhere.mockResolvedValue([]);

    const result = await getActiveShiftStockCheck();

    expect(result).toBeNull();
  });

  it("returns the open shift with its OPEN-checkpoint checks", async () => {
    mocks.findAllWhere.mockImplementation(async (sheet: string) => {
      if (sheet === "Shifts") {
        return [{ id: "SHF-001", status: "OPEN", opened_by_name: "Chủ quán", opened_at: "2026-07-23T00:00:00Z", notes: "" }];
      }
      if (sheet === "Shift_Stock_Checks") {
        return [{ id: "CHK-0001", item_reference: "BTP-013", counted_qty: "10", theoretical_qty: "9.5", variance: "0.5" }];
      }
      return [];
    });

    const result = await getActiveShiftStockCheck();

    expect(result?.shift.id).toBe("SHF-001");
    expect(result?.openChecks).toEqual([
      { id: "CHK-0001", item_reference: "BTP-013", counted_qty: 10, theoretical_qty: 9.5, variance: 0.5 },
    ]);
  });
});

describe("openShiftStockCheck / closeShiftStockCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue(authenticated);
  });

  it("rejects unauthenticated open before calling the RPC wrapper", async () => {
    mocks.resolveActor.mockResolvedValue(unauthenticated);

    const result = await openShiftStockCheck({ "BTP-013": 10 });

    expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
    expect(mocks.openShiftStockCheckAtomic).not.toHaveBeenCalled();
  });

  it("opens with the resolved actor identity and thread counts through", async () => {
    mocks.openShiftStockCheckAtomic.mockResolvedValue({ id: "SHF-001", status: "OPEN", checks: [] });

    const result = await openShiftStockCheck({ "BTP-013": 10, "NNL-012": 4 });

    expect(result).toEqual({ success: true, shift: { id: "SHF-001", status: "OPEN", checks: [] } });
    expect(mocks.openShiftStockCheckAtomic).toHaveBeenCalledWith({
      openedById: "u1",
      openedByName: "Chủ quán",
      checks: [
        { itemReference: "BTP-013", countedQty: 10 },
        { itemReference: "NNL-012", countedQty: 4 },
      ],
      notes: undefined,
    });
  });

  it("returns a friendly error when the RPC rejects (e.g. already open)", async () => {
    mocks.openShiftStockCheckAtomic.mockRejectedValue(new Error("open_shift_stock_check_atomic: A shift is already open"));

    const result = await openShiftStockCheck({ "BTP-013": 10 });

    expect(result).toEqual({ success: false, error: "open_shift_stock_check_atomic: A shift is already open" });
  });

  it("closes with the resolved actor identity and the shift id", async () => {
    mocks.closeShiftStockCheckAtomic.mockResolvedValue({ id: "SHF-001", status: "CLOSED", checks: [] });

    const result = await closeShiftStockCheck("SHF-001", { "BTP-013": 8 });

    expect(result).toEqual({ success: true, shift: { id: "SHF-001", status: "CLOSED", checks: [] } });
    expect(mocks.closeShiftStockCheckAtomic).toHaveBeenCalledWith({
      shiftId: "SHF-001",
      closedById: "u1",
      closedByName: "Chủ quán",
      checks: [{ itemReference: "BTP-013", countedQty: 8 }],
      notes: undefined,
    });
  });
});
